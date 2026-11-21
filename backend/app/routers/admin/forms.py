"""Form dashboard and editor endpoints."""

from fastapi import APIRouter, Depends, status

from app.db import DbSession
from app.schemas.forms import FormContent, FormCreate, FormDetail, FormSummary
from app.schemas.participant import PreviewPayload
from app.security import require_admin
from app.services import deletion, forms
from app.services.participant_view import build_preview

router = APIRouter(prefix="/api/admin/forms", tags=["forms"], dependencies=[Depends(require_admin)])


@router.get("")
def list_forms(session: DbSession) -> list[FormSummary]:
    """List all forms."""
    return forms.list_summaries(session)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_form(payload: FormCreate, session: DbSession) -> FormDetail:
    """Create a draft form."""
    return forms.create_form(session, payload.title)


@router.get("/{form_id}")
def read_form(form_id: int, session: DbSession) -> FormDetail:
    """Return one form for the editor."""
    return forms.get_detail(session, form_id)


@router.put("/{form_id}")
def save_form(form_id: int, content: FormContent, session: DbSession) -> FormDetail:
    """Save the editor's content."""
    return forms.save_content(session, form_id, content)


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form(form_id: int, session: DbSession) -> None:
    """Delete a form and its responses."""
    deletion.delete_form(session, form_id)


@router.post("/{form_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_form(form_id: int, session: DbSession) -> FormDetail:
    """Copy a form into a new draft."""
    return forms.duplicate_form(session, form_id)


@router.post("/{form_id}/publish")
def publish_form(form_id: int, session: DbSession) -> FormDetail:
    """Open a form to participants."""
    return forms.publish_form(session, form_id)


@router.post("/{form_id}/close")
def close_form(form_id: int, session: DbSession) -> FormDetail:
    """Stop accepting participants."""
    return forms.close_form(session, form_id)


@router.get("/{form_id}/preview")
def preview_form(form_id: int, variant: str, session: DbSession) -> PreviewPayload:
    """Return a form as one variant would see it. Nothing is stored."""
    form = forms.get_form(session, form_id)
    return build_preview(session, form, forms.load_content(session, form), variant)
