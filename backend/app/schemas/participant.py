"""Participant-facing models. They carry only what one assigned variant needs."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.results import StepResultIn
from app.schemas.steps import QuestionKind, QuestionOption, StepType, TargetBox

DeviceType = Literal["phone", "tablet", "desktop"]


class ConsentContent(BaseModel):
    version: int
    title: str
    organiser: str
    purpose: str
    collected: str
    not_collected: str
    voluntary: str
    anonymity: str
    age: str
    contact: str
    deletion_date: date | None


class StudyInfo(BaseModel):
    title: str
    is_open: bool
    block_repeats: bool
    consent: ConsentContent


class ParticipantStep(BaseModel):
    """One step as the runtime needs it. Fields that do not apply to the step type stay None."""

    key: str
    type: StepType
    required: bool = True
    title: str | None = None
    body_html: str | None = None
    button_label: str | None = None
    prompt: str | None = None
    help_text: str | None = None
    instruction: str | None = None
    ready_label: str | None = None
    duration_ms: int | None = None
    timeout_ms: int | None = None
    image_url: str | None = None
    kind: QuestionKind | None = None
    options: list[QuestionOption] | None = None
    multiple: bool | None = None
    allow_other: bool | None = None
    scale_min: int | None = None
    scale_max: int | None = None
    scale_min_label: str | None = None
    scale_max_label: str | None = None
    # Sent only to the admin's preview, so a real participant can never read the answer.
    target: TargetBox | None = None


class SessionStart(BaseModel):
    agreed: Literal[True]
    consent_version: int
    device_type: DeviceType
    viewport_width: int = Field(ge=1, le=20_000)
    viewport_height: int = Field(ge=1, le=20_000)


class SessionState(BaseModel):
    participant_id: str
    token: str
    steps: list[ParticipantStep]
    # Index of the next step to show; None when the session is complete.
    next_index: int | None
    interrupted: bool


class StepFinish(BaseModel):
    result: Annotated[StepResultIn, Field()]


class PreviewPayload(BaseModel):
    title: str
    variant_label: str
    consent: ConsentContent
    steps: list[ParticipantStep]
