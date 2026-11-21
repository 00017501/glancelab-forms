"""What a participant's browser submits when a step finishes, one model per step type."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.steps import StepType

Fraction = Annotated[float, Field(ge=0, le=1)]
Pointer = Literal["mouse", "touch", "pen", "unknown"]
# The value a choice question submits when the participant picked the free-text "Other" option.
OTHER_KEY = "__other__"


class TextResult(BaseModel):
    type: Literal[StepType.TEXT] = StepType.TEXT


class StimulusResult(BaseModel):
    type: Literal[StepType.STIMULUS] = StepType.STIMULUS
    shown_ms: int = Field(ge=0, le=600_000)


class DistractorResult(BaseModel):
    type: Literal[StepType.DISTRACTOR] = StepType.DISTRACTOR
    attempted: int = Field(ge=0, le=10_000)
    correct: int = Field(ge=0, le=10_000)


class QuestionResult(BaseModel):
    type: Literal[StepType.QUESTION] = StepType.QUESTION
    value: str | int | list[str] | None = None
    other: Annotated[str, Field(max_length=1000)] | None = None


class ClickImageResult(BaseModel):
    type: Literal[StepType.CLICK_IMAGE] = StepType.CLICK_IMAGE
    x: Fraction | None = None
    y: Fraction | None = None
    pointer: Pointer = "unknown"


class TimedSearchResult(BaseModel):
    type: Literal[StepType.TIMED_SEARCH] = StepType.TIMED_SEARCH
    rt_ms: int | None = Field(default=None, ge=0, le=600_000)
    x: Fraction | None = None
    y: Fraction | None = None
    pointer: Pointer = "unknown"


type StepResultIn = Annotated[
    TextResult | StimulusResult | DistractorResult | QuestionResult | ClickImageResult | TimedSearchResult,
    Field(discriminator="type"),
]
