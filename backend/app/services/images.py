"""Validate, resize, store, list and delete library images."""

import io
import logging
import secrets
from collections.abc import Mapping
from dataclasses import dataclass

from PIL import Image as PillowImage
from PIL import ImageOps, UnidentifiedImageError
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.errors import AppError, ImageInUseError, ImageTooLargeError, InvalidImageError, NotFoundError
from app.models import Form, Image, Step
from app.schemas.admin import ImageLibrary, ImageResponse, ImageUsage, UploadFailure, UploadOutcome
from app.settings import Settings
from app.storage.client import ObjectStorage

logger = logging.getLogger(__name__)

ACCEPTED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
# Every stored image is re-encoded to this type, which also drops embedded metadata.
STORED_CONTENT_TYPE = "image/webp"
# High enough that fine print such as a price stays sharp after re-encoding.
WEBP_QUALITY = 92
# Refuse absurd pixel counts before decoding, so a small crafted file cannot exhaust memory.
MAX_PIXELS = 60_000_000


@dataclass(frozen=True)
class ProcessedImage:
    """A re-encoded image and its thumbnail, ready to store."""

    body: bytes
    thumbnail: bytes
    width: int
    height: int


def process_image(raw: bytes, settings: Settings) -> ProcessedImage:
    """Decode an upload, check it really is an image, and return resized WebP bytes."""
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise ImageTooLargeError(f"That image is larger than {settings.max_upload_mb} MB.")
    try:
        with PillowImage.open(io.BytesIO(raw)) as probe:
            if probe.format not in ACCEPTED_FORMATS or probe.width * probe.height > MAX_PIXELS:
                raise InvalidImageError
            probe.verify()
        # `verify` leaves the file unusable, so decoding needs a fresh handle.
        with PillowImage.open(io.BytesIO(raw)) as opened:
            picture = ImageOps.exif_transpose(opened).convert("RGBA" if "A" in opened.getbands() else "RGB")
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as error:
        raise InvalidImageError from error

    picture.thumbnail((settings.image_max_edge_px, settings.image_max_edge_px), PillowImage.Resampling.LANCZOS)
    small = picture.copy()
    small.thumbnail((settings.thumbnail_edge_px, settings.thumbnail_edge_px), PillowImage.Resampling.LANCZOS)
    return ProcessedImage(
        body=encode_webp(picture, WEBP_QUALITY),
        thumbnail=encode_webp(small, 80),
        width=picture.width,
        height=picture.height,
    )


def encode_webp(picture: PillowImage.Image, quality: int) -> bytes:
    """Encode a decoded image as WebP without any metadata."""
    buffer = io.BytesIO()
    picture.save(buffer, format="WEBP", quality=quality, method=4)
    return buffer.getvalue()


def upload_images(
    session: Session, storage: ObjectStorage, settings: Settings, files: list[tuple[str, bytes]]
) -> UploadOutcome:
    """Process and store every upload, then record the ones that succeeded.

    Decoding, resizing and storing happen before the first database statement, so the database's
    write lock is never held while that slow work runs and participants are not kept waiting.
    """
    outcome = UploadOutcome(uploaded=[], failed=[])
    stored: list[Image] = []
    for filename, raw in files:
        try:
            processed = process_image(raw, settings)
            stem = secrets.token_hex(16)
            image = Image(
                storage_key=f"{stem}.webp",
                thumbnail_key=f"{stem}-thumb.webp",
                filename=filename[:200] or "image",
                width=processed.width,
                height=processed.height,
                size_bytes=len(processed.body) + len(processed.thumbnail),
            )
            storage.put(image.storage_key, processed.body, STORED_CONTENT_TYPE)
            storage.put(image.thumbnail_key, processed.thumbnail, STORED_CONTENT_TYPE)
            stored.append(image)
        except AppError as error:
            outcome.failed.append(UploadFailure(filename=filename, message=error.message))

    for image in stored:
        session.add(image)
    session.flush()
    outcome.uploaded = [to_response(image, []) for image in stored]
    logger.info("images_uploaded", extra={"count": len(stored), "failed": len(outcome.failed)})
    return outcome


def image_url(storage_key: str) -> str:
    """Return the same-origin URL that serves a stored image."""
    return f"/img/{storage_key}"


def to_response(image: Image, used_by: list[ImageUsage]) -> ImageResponse:
    """Build the admin view of an image."""
    return ImageResponse(
        id=image.id or 0,
        filename=image.filename,
        width=image.width,
        height=image.height,
        size_bytes=image.size_bytes,
        created_at=image.created_at,
        url=image_url(image.storage_key),
        thumbnail_url=image_url(image.thumbnail_key),
        used_by=used_by,
    )


def referenced_image_ids(config: Mapping[str, object]) -> set[int]:
    """Return every image id a stored step config points at."""
    ids: set[int] = set()
    single = config.get("image_id")
    if isinstance(single, int):
        ids.add(single)
    per_variant = config.get("images")
    if isinstance(per_variant, dict):
        ids.update(value for value in per_variant.values() if isinstance(value, int))
    return ids


def find_usage(session: Session) -> dict[int, list[ImageUsage]]:
    """Map each image id to the forms that use it."""
    rows = session.exec(select(Step.config, Form.id, Form.title).join(Form, col(Form.id) == col(Step.form_id))).all()
    usage: dict[int, dict[int, ImageUsage]] = {}
    for config, form_id, title in rows:
        for image_id in referenced_image_ids(config):
            usage.setdefault(image_id, {})[form_id or 0] = ImageUsage(form_id=form_id or 0, form_title=title)
    return {image_id: list(forms.values()) for image_id, forms in usage.items()}


def list_library(session: Session) -> ImageLibrary:
    """Return every image, newest first, with where it is used and the total stored size."""
    usage = find_usage(session)
    images = session.exec(select(Image).order_by(col(Image.created_at).desc(), col(Image.id).desc())).all()
    total = session.exec(select(func.coalesce(func.sum(Image.size_bytes), 0))).one()
    return ImageLibrary(
        images=[to_response(image, usage.get(image.id or 0, [])) for image in images], total_bytes=int(total)
    )


def delete_image(session: Session, storage: ObjectStorage, image_id: int) -> None:
    """Delete an image and its bytes, unless a form still uses it."""
    image = session.get(Image, image_id)
    if image is None:
        raise NotFoundError("That image no longer exists.")
    used_by = find_usage(session).get(image_id, [])
    if used_by:
        titles = ", ".join(f'"{usage.form_title}"' for usage in used_by)
        raise ImageInUseError(f"This image is used by {titles}. Remove it from there first.")

    storage.delete(image.storage_key)
    storage.delete(image.thumbnail_key)
    session.delete(image)
    logger.info("image_deleted", extra={"image_id": image_id})


def delete_all_images(session: Session, storage: ObjectStorage) -> int:
    """Delete every image and its bytes. Used only by the full wipe."""
    images = session.exec(select(Image)).all()
    for image in images:
        storage.delete(image.storage_key)
        storage.delete(image.thumbnail_key)
        session.delete(image)
    return len(images)
