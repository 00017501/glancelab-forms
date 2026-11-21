"""Image metadata. The bytes live in object storage."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.utils import utc_now


class Image(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    storage_key: str = Field(unique=True)
    thumbnail_key: str = Field(unique=True)
    filename: str
    width: int
    height: int
    size_bytes: int
    created_at: datetime = Field(default_factory=utc_now)
