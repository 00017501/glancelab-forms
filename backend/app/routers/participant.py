"""Public participant endpoints. No login; a session is addressed by the token issued at consent."""

from typing import Annotated

from fastapi import APIRouter, Header, status

from app.db import DbSession
from app.schemas.participant import SessionStart, SessionState, StepFinish, StudyInfo
from app.security import AppSettings
from app.services import sessions

router = APIRouter(prefix="/api/p", tags=["participant"])


@router.get("/studies/{slug}")
def read_study(slug: str, session: DbSession) -> StudyInfo:
    """Return the study title and consent text. Stores nothing."""
    return sessions.get_study_info(session, slug)


@router.post("/studies/{slug}/sessions", status_code=status.HTTP_201_CREATED)
def start_session(
    slug: str,
    start: SessionStart,
    session: DbSession,
    settings: AppSettings,
    user_agent: Annotated[str, Header()] = "",
) -> SessionState:
    """Create a session after consent and assign a variant."""
    return sessions.start_session(session, slug, start, user_agent, settings.active_session_minutes)


@router.get("/sessions/{token}")
def resume_session(token: str, session: DbSession) -> SessionState:
    """Continue a session after a page load."""
    return sessions.resume_session(session, token)


@router.post("/sessions/{token}/steps/{step_key}/start", status_code=status.HTTP_204_NO_CONTENT)
def start_step(token: str, step_key: str, session: DbSession) -> None:
    """Record that a timed step is about to be shown."""
    sessions.start_step(session, token, step_key)


@router.post("/sessions/{token}/steps/{step_key}/finish")
def finish_step(token: str, step_key: str, finish: StepFinish, session: DbSession) -> SessionState:
    """Store a step's result."""
    return sessions.finish_step(session, token, step_key, finish.result)


@router.delete("/sessions/{token}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw(token: str, session: DbSession) -> None:
    """Withdraw: delete the session and everything recorded for it."""
    sessions.withdraw(session, token)
