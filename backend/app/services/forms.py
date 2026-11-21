"""Create, read, save, duplicate and publish forms."""

import logging

import nh3
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.errors import FormLockedError, FormNotReadyError, InvalidFormError, NotFoundError
from app.models import ConsentVersion, Form, FormStatus, Image, SessionStatus, Step, StudySession, Variant
from app.schemas.forms import FormContent, FormDetail, FormSummary, StepContent, VariantContent
from app.schemas.steps import ConsentConfig, StepType, TextConfig, TimedSearchConfig, parse_step_config
from app.services.edit_guard import is_text_only_change
from app.services.readiness import find_publish_problems
from app.utils import random_code, random_key, utc_now

logger = logging.getLogger(__name__)

# Length of the random part of a public study link.
SLUG_LENGTH = 8
# Formatting the rich-text editor can produce; everything else is stripped before storing.
ALLOWED_TAGS = {"p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a"}
ALLOWED_ATTRIBUTES = {"a": {"href"}}


def get_form(session: Session, form_id: int) -> Form:
    """Return a form or raise when it does not exist."""
    form = session.get(Form, form_id)
    if form is None:
        raise NotFoundError("That form no longer exists.")
    return form


def load_content(session: Session, form: Form) -> FormContent:
    """Read a form's variants and steps into the shape the editor works with."""
    variants = session.exec(select(Variant).where(Variant.form_id == form.id).order_by(col(Variant.position))).all()
    steps = session.exec(select(Step).where(Step.form_id == form.id).order_by(col(Step.position))).all()
    return FormContent(
        title=form.title,
        block_repeats=form.block_repeats,
        variants=[VariantContent(key=variant.key, label=variant.label) for variant in variants],
        steps=[
            StepContent(key=step.key, required=step.required, config=parse_step_config(step.config)) for step in steps
        ],
    )


def count_responses(session: Session, form_id: int) -> int:
    """Return how many sessions, finished or not, a form has."""
    return session.exec(select(func.count()).select_from(StudySession).where(StudySession.form_id == form_id)).one()


def known_image_ids(session: Session) -> set[int]:
    """Return the ids of every image in the library."""
    return set(session.exec(select(Image.id)).all()) - {None}  # pyright: ignore[reportReturnType]


def get_detail(session: Session, form_id: int) -> FormDetail:
    """Return a form with everything the editor needs."""
    form = get_form(session, form_id)
    content = load_content(session, form)
    response_count = count_responses(session, form_id)
    return FormDetail(
        **content.model_dump(),
        id=form_id,
        slug=form.slug,
        status=form.status,
        consent_version=form.consent_version,
        response_count=response_count,
        structure_locked=form.status is FormStatus.PUBLISHED or response_count > 0,
        publish_problems=find_publish_problems(content, known_image_ids(session)),
        updated_at=form.updated_at,
    )


def list_summaries(session: Session) -> list[FormSummary]:
    """Return every form with its step, variant and response counts, newest first."""
    forms = session.exec(select(Form).order_by(col(Form.updated_at).desc())).all()
    variant_counts = dict(session.exec(select(Variant.form_id, func.count()).group_by(col(Variant.form_id))).all())
    step_counts = dict(session.exec(select(Step.form_id, func.count()).group_by(col(Step.form_id))).all())
    session_counts = session.exec(
        select(StudySession.form_id, StudySession.status, func.count()).group_by(
            col(StudySession.form_id), col(StudySession.status)
        )
    ).all()
    by_status = {(form_id, status): count for form_id, status, count in session_counts}

    return [
        FormSummary(
            id=form.id or 0,
            slug=form.slug,
            title=form.title,
            status=form.status,
            created_at=form.created_at,
            updated_at=form.updated_at,
            variant_count=variant_counts.get(form.id or 0, 0),
            step_count=step_counts.get(form.id or 0, 0),
            completed_count=by_status.get((form.id or 0, SessionStatus.COMPLETED), 0),
            partial_count=by_status.get((form.id or 0, SessionStatus.ACTIVE), 0),
        )
        for form in forms
    ]


def create_form(session: Session, title: str) -> FormDetail:
    """Create a draft with two variants and the mandatory consent step."""
    form = Form(slug=random_code(SLUG_LENGTH).lower(), title=title)
    session.add(form)
    session.flush()
    content = FormContent(
        title=title,
        variants=[VariantContent(key=random_key(), label="A"), VariantContent(key=random_key(), label="B")],
        steps=[StepContent(key=random_key(), config=ConsentConfig())],
    )
    write_content(session, form, content)
    return get_detail(session, form.id or 0)


def save_content(session: Session, form_id: int, proposed: FormContent) -> FormDetail:
    """Save the editor's content, refusing structural changes while the form is locked."""
    form = get_form(session, form_id)
    proposed = clean_content(proposed)
    check_consent_placement(proposed)

    current = load_content(session, form)
    locked = form.status is FormStatus.PUBLISHED or count_responses(session, form_id) > 0
    if locked and not is_text_only_change(current, proposed):
        raise FormLockedError

    write_content(session, form, proposed)
    return get_detail(session, form_id)


def clean_content(content: FormContent) -> FormContent:
    """Strip unsafe HTML and drop image and target entries for variants that no longer exist."""
    variant_keys = {variant.key for variant in content.variants}
    steps: list[StepContent] = []
    for step in content.steps:
        config = step.config
        if isinstance(config, TextConfig):
            config = config.model_copy(
                update={"body_html": nh3.clean(config.body_html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)}
            )
        if hasattr(config, "images"):
            images = {key: value for key, value in config.images.items() if key in variant_keys}  # pyright: ignore[reportAttributeAccessIssue]
            config = config.model_copy(update={"images": images})
        if isinstance(config, TimedSearchConfig):
            targets = {key: value for key, value in config.targets.items() if key in variant_keys}
            config = config.model_copy(update={"targets": targets})
        steps.append(step.model_copy(update={"config": config}))
    return content.model_copy(update={"steps": steps})


def check_consent_placement(content: FormContent) -> None:
    """The consent step is mandatory, unique and always first."""
    types = [step.config.type for step in content.steps]
    if types[0] is not StepType.CONSENT or types.count(StepType.CONSENT) != 1:
        raise InvalidFormError("Every form starts with exactly one consent step, and it cannot be moved or removed.")


def write_content(session: Session, form: Form, content: FormContent) -> None:
    """Replace a form's variants and steps with the given content, keeping rows whose key survives."""
    form_id = form.id or 0
    form.title = content.title
    form.block_repeats = content.block_repeats
    form.updated_at = utc_now()

    existing_variants = {v.key: v for v in session.exec(select(Variant).where(Variant.form_id == form_id)).all()}
    for position, variant in enumerate(content.variants):
        row = existing_variants.pop(variant.key, None) or Variant(
            form_id=form_id, key=variant.key, label="", position=0
        )
        row.label, row.position = variant.label, position
        session.add(row)

    existing_steps = {s.key: s for s in session.exec(select(Step).where(Step.form_id == form_id)).all()}
    for position, step in enumerate(content.steps):
        row = existing_steps.pop(step.key, None) or Step(form_id=form_id, key=step.key, position=0, type="")
        row.position, row.type, row.required = position, step.config.type.value, step.required
        row.config = step.config.model_dump(mode="json")
        session.add(row)

    for stale in (*existing_steps.values(), *existing_variants.values()):
        session.delete(stale)
    record_consent_wording(session, form, content)
    session.add(form)
    session.flush()


def record_consent_wording(session: Session, form: Form, content: FormContent) -> None:
    """Keep the stored consent wording in step with the form, versioning it once people have seen it."""
    wording = content.steps[0].config.model_dump(mode="json")
    current = session.exec(
        select(ConsentVersion).where(ConsentVersion.form_id == form.id, ConsentVersion.version == form.consent_version)
    ).first()
    if current is None:
        session.add(ConsentVersion(form_id=form.id or 0, version=form.consent_version, content=wording))
        return
    if current.content == wording:
        return

    seen = session.exec(
        select(func.count())
        .select_from(StudySession)
        .where(StudySession.form_id == form.id, StudySession.consent_version == form.consent_version)
    ).one()
    if seen:
        form.consent_version += 1
        session.add(ConsentVersion(form_id=form.id or 0, version=form.consent_version, content=wording))
    else:
        current.content = wording
        session.add(current)


def duplicate_form(session: Session, form_id: int) -> FormDetail:
    """Copy a form's structure into a new draft. Responses are never copied."""
    source = get_form(session, form_id)
    content = load_content(session, source)
    copy = Form(
        slug=random_code(SLUG_LENGTH).lower(), title=f"{source.title} (copy)", block_repeats=source.block_repeats
    )
    session.add(copy)
    session.flush()
    write_content(session, copy, content.model_copy(update={"title": copy.title}))
    return get_detail(session, copy.id or 0)


def publish_form(session: Session, form_id: int) -> FormDetail:
    """Open a form to participants once nothing is missing."""
    form = get_form(session, form_id)
    problems = find_publish_problems(load_content(session, form), known_image_ids(session))
    if problems:
        raise FormNotReadyError(details=problems)
    form.status = FormStatus.PUBLISHED
    form.updated_at = utc_now()
    session.add(form)
    logger.info("form_published", extra={"form_id": form_id})
    return get_detail(session, form_id)


def close_form(session: Session, form_id: int) -> FormDetail:
    """Stop accepting new participants. People already in the study can finish."""
    form = get_form(session, form_id)
    if form.status is FormStatus.PUBLISHED:
        form.status = FormStatus.CLOSED
        form.updated_at = utc_now()
        session.add(form)
        logger.info("form_closed", extra={"form_id": form_id})
    return get_detail(session, form_id)
