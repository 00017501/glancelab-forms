"""Hard deletion of responses, forms and, for the full wipe, everything."""

import logging

from sqlalchemy import delete
from sqlmodel import Session, col, select

from app.errors import ConfirmationMismatchError
from app.models import ConsentVersion, Form, Step, StepResult, StudySession, Variant
from app.services.forms import get_form
from app.services.images import delete_all_images
from app.storage.client import ObjectStorage

logger = logging.getLogger(__name__)

# What the admin must type to confirm the full wipe.
WIPE_CONFIRMATION = "DELETE EVERYTHING"


def delete_responses(session: Session, form_id: int | None = None, public_id: str | None = None) -> int:
    """Hard-delete sessions and their results: one session, one form's sessions, or all of them."""
    query = select(StudySession.id)
    if form_id is not None:
        query = query.where(StudySession.form_id == form_id)
    if public_id is not None:
        query = query.where(StudySession.public_id == public_id)
    session_ids = list(session.exec(query).all())
    if not session_ids:
        return 0
    session.exec(delete(StepResult).where(col(StepResult.session_id).in_(session_ids)))  # pyright: ignore[reportCallIssue,reportArgumentType]
    session.exec(delete(StudySession).where(col(StudySession.id).in_(session_ids)))  # pyright: ignore[reportCallIssue,reportArgumentType]
    logger.info("responses_deleted", extra={"form_id": form_id, "count": len(session_ids)})
    return len(session_ids)


def delete_form(session: Session, form_id: int) -> None:
    """Delete a form with its steps, variants, consent wordings and every response."""
    form = get_form(session, form_id)
    delete_responses(session, form_id=form_id)
    for model in (Step, Variant, ConsentVersion):
        session.exec(delete(model).where(col(model.form_id) == form_id))  # pyright: ignore[reportCallIssue,reportArgumentType]
    session.delete(form)
    logger.info("form_deleted", extra={"form_id": form_id})


def wipe_everything(
    session: Session, storage: ObjectStorage, confirmation: str, *, include_forms_and_images: bool
) -> int:
    """Delete every response, and optionally every form and image too."""
    if confirmation.strip() != WIPE_CONFIRMATION:
        raise ConfirmationMismatchError(f'Type "{WIPE_CONFIRMATION}" exactly to confirm.')
    deleted = delete_responses(session)
    if include_forms_and_images:
        for model in (Step, Variant, ConsentVersion, Form):
            session.exec(delete(model))  # pyright: ignore[reportCallIssue,reportArgumentType]
        delete_all_images(session, storage)
    logger.info("data_wiped", extra={"responses": deleted, "everything": include_forms_and_images})
    return deleted
