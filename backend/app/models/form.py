"""Forms, their variants, steps and stored consent wordings."""

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.utils import utc_now


class FormStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class Form(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(index=True, unique=True)
    title: str
    status: FormStatus = Field(default=FormStatus.DRAFT)
    block_repeats: bool = Field(default=True)
    consent_version: int = Field(default=1)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Variant(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("form_id", "key"),)

    id: int | None = Field(default=None, primary_key=True)
    form_id: int = Field(foreign_key="form.id", index=True, ondelete="CASCADE")
    key: str
    label: str
    position: int


class Step(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("form_id", "key"),)

    id: int | None = Field(default=None, primary_key=True)
    form_id: int = Field(foreign_key="form.id", index=True, ondelete="CASCADE")
    key: str
    position: int
    type: str
    required: bool = Field(default=True)
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class ConsentVersion(SQLModel, table=True):
    """The exact consent wording shown under one version number."""

    __table_args__ = (UniqueConstraint("form_id", "version"),)

    id: int | None = Field(default=None, primary_key=True)
    form_id: int = Field(foreign_key="form.id", index=True, ondelete="CASCADE")
    version: int
    content: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)
