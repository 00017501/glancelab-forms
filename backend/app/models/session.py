"""Participant sessions and their per-step results."""

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.utils import utc_now


class SessionStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"


class ResultStatus(StrEnum):
    STARTED = "started"
    DONE = "done"
    INTERRUPTED = "interrupted"


class StudySession(SQLModel, table=True):
    """One participant's run through one form. Created only after consent."""

    id: int | None = Field(default=None, primary_key=True)
    public_id: str = Field(index=True, unique=True)
    token: str = Field(index=True, unique=True)
    form_id: int = Field(foreign_key="form.id", index=True, ondelete="CASCADE")
    variant_id: int = Field(foreign_key="variant.id", index=True)
    status: SessionStatus = Field(default=SessionStatus.ACTIVE)
    interrupted: bool = Field(default=False)
    device_type: str
    viewport_width: int
    viewport_height: int
    user_agent: str
    consent_at: datetime
    consent_version: int
    started_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None


class StepResult(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("session_id", "step_id"),)

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="studysession.id", index=True, ondelete="CASCADE")
    step_id: int = Field(foreign_key="step.id", index=True)
    status: ResultStatus
    data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: datetime | None = None
