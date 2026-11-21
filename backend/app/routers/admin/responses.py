"""Responses table, CSV export and deletion endpoints."""

from fastapi import APIRouter, Depends, Response

from app.db import DbSession
from app.schemas.admin import DeletedCount, ResponseList, WipeRequest
from app.security import require_admin
from app.services import deletion, export, forms, responses
from app.storage.client import Storage

router = APIRouter(prefix="/api/admin", tags=["responses"], dependencies=[Depends(require_admin)])


def csv_response(text: str, filename: str) -> Response:
    """Return CSV text as a download. The BOM makes Excel read it as UTF-8."""
    return Response(
        content="﻿" + text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/forms/{form_id}/responses")
def list_responses(form_id: int, session: DbSession) -> ResponseList:
    """List a form's responses."""
    forms.get_form(session, form_id)
    return responses.list_responses(session, form_id)


@router.get("/forms/{form_id}/responses.csv", response_model=None)
def download_responses(form_id: int, session: DbSession) -> Response:
    """Download a form's responses, one row per participant."""
    form = forms.get_form(session, form_id)
    return csv_response(export.export_csv(session, form_id), f"glancelab-{form.slug}-responses.csv")


@router.get("/forms/{form_id}/codebook.csv", response_model=None)
def download_codebook(form_id: int, session: DbSession) -> Response:
    """Download the explanation of every CSV column."""
    form = forms.get_form(session, form_id)
    return csv_response(export.export_codebook(session, form_id), f"glancelab-{form.slug}-codebook.csv")


@router.delete("/forms/{form_id}/responses")
def clear_responses(form_id: int, session: DbSession) -> DeletedCount:
    """Delete every response of a form."""
    forms.get_form(session, form_id)
    return DeletedCount(deleted=deletion.delete_responses(session, form_id=form_id))


@router.delete("/forms/{form_id}/responses/{participant_id}")
def delete_response(form_id: int, participant_id: str, session: DbSession) -> DeletedCount:
    """Delete one response."""
    return DeletedCount(deleted=deletion.delete_responses(session, form_id=form_id, public_id=participant_id))


@router.post("/wipe")
def wipe(request: WipeRequest, session: DbSession, storage: Storage) -> DeletedCount:
    """Delete all responses, and optionally all forms and images."""
    deleted = deletion.wipe_everything(
        session, storage, request.confirmation, include_forms_and_images=request.include_forms_and_images
    )
    return DeletedCount(deleted=deleted)
