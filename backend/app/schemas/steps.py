"""Step settings: one model per step type, joined by a discriminated union on `type`."""

from datetime import date
from enum import StrEnum
from typing import Annotated, Any, ClassVar, Literal

from pydantic import BaseModel, Field, TypeAdapter, model_validator


class StepType(StrEnum):
    CONSENT = "consent"
    TEXT = "text"
    STIMULUS = "stimulus"
    DISTRACTOR = "distractor"
    QUESTION = "question"
    CLICK_IMAGE = "click_image"
    TIMED_SEARCH = "timed_search"


class QuestionKind(StrEnum):
    CHOICE = "choice"
    DROPDOWN = "dropdown"
    SHORT_TEXT = "short_text"
    PARAGRAPH = "paragraph"
    SCALE = "scale"


# Step types that must never be shown twice to one session.
TIMED_STEP_TYPES = frozenset({StepType.STIMULUS, StepType.DISTRACTOR, StepType.TIMED_SEARCH})

ShortText = Annotated[str, Field(max_length=300)]
LongText = Annotated[str, Field(max_length=2000)]
RichText = Annotated[str, Field(max_length=20_000)]
# Maps a variant key to an image id; None while the admin has not picked an image yet.
VariantImages = dict[str, int | None]


class StepConfigBase(BaseModel):
    """Shared behaviour: which fields are wording, and what remains as structure."""

    # Fields that may still be edited after the form is published.
    text_fields: ClassVar[frozenset[str]] = frozenset()

    def structure(self) -> dict[str, Any]:
        """Return everything except wording; two configs with equal structure collect the same data."""
        return self.model_dump(mode="json", exclude=set(self.text_fields))


class ConsentConfig(StepConfigBase):
    type: Literal[StepType.CONSENT] = StepType.CONSENT
    title: ShortText = "Before you start"
    organiser: LongText = ""
    purpose: LongText = ""
    collected: LongText = (
        "Your answers, reaction times, click positions, device type, screen size, "
        "browser type (user agent) and the times at which you start and finish each step."
    )
    not_collected: LongText = (
        "We do not collect your name, email address, IP address or location. "
        "We do not use tracking cookies, your camera or your microphone."
    )
    voluntary: LongText = (
        "Taking part is voluntary. You can leave at any time without giving a reason, "
        "using the Leave study link. If you leave, everything you entered is deleted."
    )
    anonymity: LongText = (
        "Your data is anonymous and cannot be linked to you. It is used only for this "
        "coursework and is stored securely."
    )
    age: LongText = "You must be 18 or older to take part."
    contact: LongText = ""
    deletion_date: date | None = None

    text_fields: ClassVar[frozenset[str]] = frozenset(
        {
            "title",
            "organiser",
            "purpose",
            "collected",
            "not_collected",
            "voluntary",
            "anonymity",
            "age",
            "contact",
            "deletion_date",
        }
    )


class TextConfig(StepConfigBase):
    type: Literal[StepType.TEXT] = StepType.TEXT
    title: ShortText = ""
    body_html: RichText = ""
    button_label: Annotated[str, Field(max_length=40)] = "Continue"

    text_fields: ClassVar[frozenset[str]] = frozenset({"title", "body_html", "button_label"})


def without_unset(entries: dict[str, Any]) -> dict[str, Any]:
    """Drop entries that hold nothing, so `{}` and `{"a": None}` count as the same structure."""
    return {key: value for key, value in entries.items() if value is not None}


class StimulusConfig(StepConfigBase):
    type: Literal[StepType.STIMULUS] = StepType.STIMULUS
    duration_ms: int = Field(default=5000, ge=100, le=120_000)
    images: VariantImages = Field(default_factory=dict)

    def structure(self) -> dict[str, Any]:
        structure = super().structure()
        structure["images"] = without_unset(structure["images"])
        return structure


class DistractorConfig(StepConfigBase):
    type: Literal[StepType.DISTRACTOR] = StepType.DISTRACTOR
    instruction: LongText = "Solve as many sums as you can. Type the answer and press OK."
    duration_ms: int = Field(default=20_000, ge=1000, le=300_000)

    text_fields: ClassVar[frozenset[str]] = frozenset({"instruction"})


class QuestionOption(BaseModel):
    key: Annotated[str, Field(min_length=1, max_length=32)]
    label: ShortText


class QuestionConfig(StepConfigBase):
    type: Literal[StepType.QUESTION] = StepType.QUESTION
    kind: QuestionKind = QuestionKind.CHOICE
    prompt: LongText = ""
    help_text: LongText = ""
    options: list[QuestionOption] = Field(default_factory=list, max_length=50)
    multiple: bool = False
    allow_other: bool = False
    scale_min: int = Field(default=1, ge=0, le=1)
    scale_max: int = Field(default=7, ge=2, le=11)
    scale_min_label: ShortText = ""
    scale_max_label: ShortText = ""

    text_fields: ClassVar[frozenset[str]] = frozenset({"prompt", "help_text", "scale_min_label", "scale_max_label"})

    @model_validator(mode="after")
    def check_option_keys_unique(self) -> "QuestionConfig":
        keys = [option.key for option in self.options]
        if len(keys) != len(set(keys)):
            raise ValueError("option keys must be unique")
        return self

    def structure(self) -> dict[str, Any]:
        """Option labels are wording; the set and order of option keys is structure."""
        structure = super().structure()
        structure["options"] = [option.key for option in self.options]
        return structure


class ClickImageConfig(StepConfigBase):
    type: Literal[StepType.CLICK_IMAGE] = StepType.CLICK_IMAGE
    prompt: LongText = ""
    image_id: int | None = None

    text_fields: ClassVar[frozenset[str]] = frozenset({"prompt"})


class TargetBox(BaseModel):
    """A rectangle in fractions of the displayed image, measured from its top-left corner."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class TimedSearchConfig(StepConfigBase):
    type: Literal[StepType.TIMED_SEARCH] = StepType.TIMED_SEARCH
    instruction: LongText = "Click the price as fast as you can."
    ready_label: Annotated[str, Field(max_length=40)] = "I'm ready"
    timeout_ms: int = Field(default=10_000, ge=1000, le=120_000)
    images: VariantImages = Field(default_factory=dict)
    targets: dict[str, TargetBox | None] = Field(default_factory=dict)

    text_fields: ClassVar[frozenset[str]] = frozenset({"instruction", "ready_label"})

    def structure(self) -> dict[str, Any]:
        structure = super().structure()
        structure["images"] = without_unset(structure["images"])
        structure["targets"] = without_unset(structure["targets"])
        return structure


type StepConfig = Annotated[
    ConsentConfig
    | TextConfig
    | StimulusConfig
    | DistractorConfig
    | QuestionConfig
    | ClickImageConfig
    | TimedSearchConfig,
    Field(discriminator="type"),
]

STEP_CONFIG_ADAPTER: TypeAdapter[StepConfig] = TypeAdapter(StepConfig)


def parse_step_config(raw: dict[str, Any]) -> StepConfig:
    """Validate a stored or submitted config dict into its typed model."""
    return STEP_CONFIG_ADAPTER.validate_python(raw)
