"""A participant's run: start after consent, record steps, resume, withdraw."""

import logging
import secrets

from sqlalchemy import delete
from sqlmodel import Session, col, select

from app.errors import ConsentRequiredError, NotFoundError, SessionClosedError, StepConflictError, StudyClosedError
from app.models import Form, FormStatus, ResultStatus, SessionStatus, Step, StepResult, StudySession, Variant
from app.schemas.participant import SessionStart, SessionState, StudyInfo
from app.schemas.results import StepResultIn
from app.schemas.steps import TIMED_STEP_TYPES, StepType, parse_step_config
from app.services.answers import shape_result
from app.services.assignment import assign_variant
from app.services.forms import load_content
from app.services.participant_view import build_steps, consent_content
from app.utils import random_code, utc_now

logger = logging.getLogger(__name__)

# Length of the anonymous ID shown in the responses table and the CSV.
PARTICIPANT_ID_LENGTH = 10
# Longest user-agent string kept.
USER_AGENT_LIMIT = 400


def get_form_by_slug(session: Session, slug: str) -> Form:
    """Return the form behind a public link; drafts are invisible."""
    form = session.exec(select(Form).where(Form.slug == slug)).first()
    if form is None or form.status is FormStatus.DRAFT:
        raise NotFoundError("This study link is not valid.")
    return form


def get_study_info(session: Session, slug: str) -> StudyInfo:
    """Return what a visitor sees before consenting. Nothing is stored."""
    form = get_form_by_slug(session, slug)
    return StudyInfo(
        title=form.title,
        is_open=form.status is FormStatus.PUBLISHED,
        block_repeats=form.block_repeats,
        consent=consent_content(session, form),
    )


def start_session(
    session: Session, slug: str, start: SessionStart, user_agent: str, active_minutes: int
) -> SessionState:
    """Create a session for a participant who has just agreed, and assign their variant."""
    form = get_form_by_slug(session, slug)
    if form.status is not FormStatus.PUBLISHED:
        raise StudyClosedError
    if start.consent_version != form.consent_version:
        raise ConsentRequiredError("The consent text was updated. Please read it again.")

    now = utc_now()
    study_session = StudySession(
        public_id=random_code(PARTICIPANT_ID_LENGTH),
        token=secrets.token_urlsafe(32),
        form_id=form.id or 0,
        variant_id=assign_variant(session, form.id or 0, now, active_minutes),
        device_type=start.device_type,
        viewport_width=start.viewport_width,
        viewport_height=start.viewport_height,
        user_agent=user_agent[:USER_AGENT_LIMIT],
        consent_at=now,
        consent_version=form.consent_version,
        started_at=now,
        last_seen_at=now,
    )
    session.add(study_session)
    session.flush()
    logger.info("session_started", extra={"form_id": form.id})
    return build_state(session, study_session)


def get_session_by_token(session: Session, token: str) -> StudySession:
    """Return the session a browser holds the token for."""
    study_session = session.exec(select(StudySession).where(StudySession.token == token)).first()
    if study_session is None:
        raise NotFoundError("This session no longer exists.")
    return study_session


def ordered_steps(session: Session, form_id: int) -> list[Step]:
    """Return a form's steps after consent, in order."""
    steps = session.exec(select(Step).where(Step.form_id == form_id).order_by(col(Step.position))).all()
    return [step for step in steps if step.type != StepType.CONSENT]


def results_by_step(session: Session, session_id: int) -> dict[int, StepResult]:
    """Map step ids to the result this session has for them."""
    results = session.exec(select(StepResult).where(StepResult.session_id == session_id)).all()
    return {result.step_id: result for result in results}


def next_index(steps: list[Step], results: dict[int, StepResult]) -> int | None:
    """Return the position of the first step with no result, or None when all are done."""
    for index, step in enumerate(steps):
        if (step.id or 0) not in results:
            return index
    return None


def build_state(session: Session, study_session: StudySession) -> SessionState:
    """Return the steps for this session's variant and where it should continue."""
    form = session.get(Form, study_session.form_id)
    variant = session.get(Variant, study_session.variant_id)
    if form is None or variant is None:
        raise NotFoundError
    steps = ordered_steps(session, study_session.form_id)
    return SessionState(
        participant_id=study_session.public_id,
        token=study_session.token,
        steps=build_steps(session, load_content(session, form), variant.key),
        next_index=next_index(steps, results_by_step(session, study_session.id or 0)),
        interrupted=study_session.interrupted,
    )


def resume_session(session: Session, token: str) -> SessionState:
    """Continue after a page load. A timed step that was under way is closed as interrupted, never replayed."""
    study_session = get_session_by_token(session, token)
    now = utc_now()
    started = session.exec(
        select(StepResult).where(StepResult.session_id == study_session.id, StepResult.status == ResultStatus.STARTED)
    ).all()
    for result in started:
        result.status = ResultStatus.INTERRUPTED
        result.finished_at = now
        study_session.interrupted = True
        session.add(result)

    study_session.last_seen_at = now
    session.add(study_session)
    session.flush()
    finish_if_done(session, study_session)
    return build_state(session, study_session)


def expected_step(session: Session, study_session: StudySession, step_key: str) -> Step:
    """Return the step with this key, provided it is the one the session should be on."""
    if study_session.status is not SessionStatus.ACTIVE:
        raise SessionClosedError
    steps = ordered_steps(session, study_session.form_id)
    results = results_by_step(session, study_session.id or 0)
    index = next_index(steps, results)
    started = [step for step in steps if (r := results.get(step.id or 0)) and r.status is ResultStatus.STARTED]
    current = started[0] if started else (steps[index] if index is not None else None)
    if current is None or current.key != step_key:
        raise StepConflictError
    return current


def start_step(session: Session, token: str, step_key: str) -> None:
    """Record that a timed step is about to be shown. Called before the browser renders it."""
    study_session = get_session_by_token(session, token)
    step = expected_step(session, study_session, step_key)
    existing = results_by_step(session, study_session.id or 0).get(step.id or 0)
    if existing is not None and existing.status is ResultStatus.STARTED:
        # The browser repeats this call when the first answer was lost on the way back. Only a
        # page load turns a started step into an interrupted one, so accepting the repeat is safe.
        return
    if step.type not in TIMED_STEP_TYPES or existing is not None:
        raise StepConflictError

    now = utc_now()
    session.add(
        StepResult(session_id=study_session.id or 0, step_id=step.id or 0, status=ResultStatus.STARTED, started_at=now)
    )
    study_session.last_seen_at = now
    session.add(study_session)


def finish_step(session: Session, token: str, step_key: str, submitted: StepResultIn) -> SessionState:
    """Store a step's result and say what comes next."""
    study_session = get_session_by_token(session, token)
    step = expected_step(session, study_session, step_key)
    variant = session.get(Variant, study_session.variant_id)
    existing = results_by_step(session, study_session.id or 0).get(step.id or 0)
    if step.type in TIMED_STEP_TYPES and existing is None:
        raise StepConflictError
    data = shape_result(parse_step_config(step.config), step.required, variant.key if variant else "", submitted)

    now = utc_now()
    result = existing or StepResult(
        session_id=study_session.id or 0, step_id=step.id or 0, status=ResultStatus.DONE, started_at=now
    )
    result.status, result.data, result.finished_at = ResultStatus.DONE, data, now
    session.add(result)
    study_session.last_seen_at = now
    session.add(study_session)
    session.flush()
    finish_if_done(session, study_session)
    return build_state(session, study_session)


def finish_if_done(session: Session, study_session: StudySession) -> None:
    """Mark the session completed once every step has a result."""
    if study_session.status is not SessionStatus.ACTIVE:
        return
    steps = ordered_steps(session, study_session.form_id)
    if next_index(steps, results_by_step(session, study_session.id or 0)) is None:
        study_session.status = SessionStatus.COMPLETED
        study_session.completed_at = utc_now()
        session.add(study_session)


def withdraw(session: Session, token: str) -> None:
    """Delete a session and everything recorded for it. Withdrawal leaves nothing behind."""
    study_session = session.exec(select(StudySession).where(StudySession.token == token)).first()
    if study_session is None:
        return
    session.exec(delete(StepResult).where(col(StepResult.session_id) == study_session.id))  # pyright: ignore[reportCallIssue,reportArgumentType]
    session.delete(study_session)
    logger.info("session_withdrawn", extra={"form_id": study_session.form_id})
