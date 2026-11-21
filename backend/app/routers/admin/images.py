"""Image library endpoints."""

from fastapi import APIRouter, Depends, UploadFile, status

from app.db import DbSession
from app.schemas.admin import ImageLibrary, UploadOutcome
from app.security import AppSettings, require_admin
from app.services import images
from app.storage.client import Storage

router = APIRouter(prefix="/api/admin/images", tags=["images"], dependencies=[Depends(require_admin)])


@router.get("")
def list_images(session: DbSession) -> ImageLibrary:
    """List the image library."""
    return images.list_library(session)


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_images(
    files: list[UploadFile], session: DbSession, storage: Storage, settings: AppSettings
) -> UploadOutcome:
    """Upload one or more images. A bad file is reported and does not stop the others."""
    # One byte past the limit is enough to know a file is too large without reading all of it.
    limit = settings.max_upload_mb * 1024 * 1024 + 1
    contents = [(file.filename or "image", file.file.read(limit)) for file in files]
    return images.upload_images(session, storage, settings, contents)


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(image_id: int, session: DbSession, storage: Storage) -> None:
    """Delete an unused image."""
    images.delete_image(session, storage, image_id)
