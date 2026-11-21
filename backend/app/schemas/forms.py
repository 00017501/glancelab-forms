"""Admin-facing form models."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import FormStatus
from app.schemas.steps import StepConfig

Key = Annotated[str, Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")]
Title = Annotated[str, Field(min_length=1, max_length=200)]


class FormCreate(BaseModel):
    title: Title = "Untitled study"


class VariantContent(BaseModel):
    key: Key
    label: Annotated[str, Field(min_length=1, max_length=60)]


class StepContent(BaseModel):
    key: Key
    required: bool = True
    config: StepConfig


class FormContent(BaseModel):
    """The whole editable form, saved in one request by the editor's autosave."""

    title: Title
    block_repeats: bool = True
    variants: list[VariantContent] = Field(min_length=1, max_length=12)
    steps: list[StepContent] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def check_keys_unique(self) -> "FormContent":
        for name, keys in (("variant", [v.key for v in self.variants]), ("step", [s.key for s in self.steps])):
            if len(keys) != len(set(keys)):
                raise ValueError(f"{name} keys must be unique")
        return self


class FormSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    status: FormStatus
    created_at: datetime
    updated_at: datetime
    variant_count: int
    step_count: int
    completed_count: int
    partial_count: int


class FormDetail(FormContent):
    id: int
    slug: str
    status: FormStatus
    consent_version: int
    response_count: int
    # True when only wording may change: the form is published or already has responses.
    structure_locked: bool
    publish_problems: list[str]
    updated_at: datetime
