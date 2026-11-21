"""Admin-facing models for login, images, responses and deletion."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models import SessionStatus


class LoginRequest(BaseModel):
    username: Annotated[str, Field(max_length=200)]
    password: Annotated[str, Field(max_length=200)]


class AdminInfo(BaseModel):
    username: str


class ImageUsage(BaseModel):
    form_id: int
    form_title: str


class ImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    width: int
    height: int
    size_bytes: int
    created_at: datetime
    url: str
    thumbnail_url: str
    used_by: list[ImageUsage]


class ImageLibrary(BaseModel):
    images: list[ImageResponse]
    total_bytes: int


class UploadFailure(BaseModel):
    filename: str
    message: str


class UploadOutcome(BaseModel):
    uploaded: list[ImageResponse]
    failed: list[UploadFailure]


class ResponseRow(BaseModel):
    participant_id: str
    variant: str
    status: SessionStatus
    interrupted: bool
    device_type: str
    viewport_width: int
    viewport_height: int
    started_at: datetime
    completed_at: datetime | None
    duration_seconds: float | None
    steps_done: int
    steps_total: int


class VariantCount(BaseModel):
    label: str
    completed: int
    partial: int


class ResponseList(BaseModel):
    rows: list[ResponseRow]
    variants: list[VariantCount]


class DeletedCount(BaseModel):
    deleted: int


class WipeRequest(BaseModel):
    confirmation: str
    include_forms_and_images: bool = False
