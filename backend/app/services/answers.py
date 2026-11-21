"""Check a submitted step result against the step's settings and shape it for storage."""

from typing import Any

from app.errors import InvalidAnswerError
from app.schemas.results import (
    OTHER_KEY,
    ClickImageResult,
    DistractorResult,
    QuestionResult,
    StepResultIn,
    StimulusResult,
    TimedSearchResult,
)
from app.schemas.steps import (
    ClickImageConfig,
    QuestionConfig,
    QuestionKind,
    StepConfig,
    TargetBox,
    TimedSearchConfig,
)

# Longest free-text answer kept, per question kind.
TEXT_LIMITS = {QuestionKind.SHORT_TEXT: 300, QuestionKind.PARAGRAPH: 5000}


def is_hit(x: float, y: float, box: TargetBox) -> bool:
    """Return whether a click landed inside the target box.

    All values are fractions of the displayed image, measured from its top-left corner.
    """
    return box.x <= x <= box.x + box.w and box.y <= y <= box.y + box.h


def shape_result(config: StepConfig, required: bool, variant_key: str, result: StepResultIn) -> dict[str, Any]:
    """Validate a result for its step and return the dict that is stored."""
    if result.type != config.type:
        raise InvalidAnswerError
    if isinstance(result, QuestionResult) and isinstance(config, QuestionConfig):
        return shape_question(config, required, result)
    if isinstance(result, ClickImageResult) and isinstance(config, ClickImageConfig):
        return shape_click(required, result)
    if isinstance(result, TimedSearchResult) and isinstance(config, TimedSearchConfig):
        return shape_timed_search(config.targets.get(variant_key), result)
    if isinstance(result, StimulusResult):
        return {"shown_ms": result.shown_ms}
    if isinstance(result, DistractorResult):
        return {"attempted": result.attempted, "correct": min(result.correct, result.attempted)}
    return {}


def shape_click(required: bool, result: ClickImageResult) -> dict[str, Any]:
    """A click is a pair of coordinates, or nothing when the step is optional."""
    if result.x is None or result.y is None:
        if required:
            raise InvalidAnswerError("Click the image to continue.")
        return {"x": None, "y": None, "pointer": result.pointer}
    return {"x": round(result.x, 4), "y": round(result.y, 4), "pointer": result.pointer}


def shape_timed_search(target: TargetBox | None, result: TimedSearchResult) -> dict[str, Any]:
    """Score a timed search on the server, so the target box never reaches the participant's browser."""
    if result.rt_ms is None or result.x is None or result.y is None:
        return {"outcome": "timeout", "rt_ms": None, "x": None, "y": None, "hit": None, "pointer": result.pointer}
    hit = target is not None and is_hit(result.x, result.y, target)
    return {
        "outcome": "hit" if hit else "miss",
        "rt_ms": result.rt_ms,
        "x": round(result.x, 4),
        "y": round(result.y, 4),
        "hit": hit,
        "pointer": result.pointer,
    }


def shape_question(config: QuestionConfig, required: bool, result: QuestionResult) -> dict[str, Any]:
    """Validate an answer against the question's kind and options."""
    value, other = result.value, (result.other or "").strip() or None
    if config.kind in TEXT_LIMITS:
        value = shape_text(value, TEXT_LIMITS[config.kind])
    elif config.kind is QuestionKind.SCALE:
        value = shape_scale(config, value)
    elif config.multiple and config.kind is QuestionKind.CHOICE:
        value = shape_choices(config, value)
    else:
        value = shape_choice(config, value)

    uses_other = value == OTHER_KEY or (isinstance(value, list) and OTHER_KEY in value)
    if uses_other and other is None:
        raise InvalidAnswerError('Please fill in the "Other" answer.')
    if required and value in (None, "", []):
        raise InvalidAnswerError("This question needs an answer.")
    return {"value": value, "other": other if uses_other else None}


def shape_text(value: object, limit: int) -> str | None:
    """Return trimmed free text, or None when it is empty."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise InvalidAnswerError
    return value.strip()[:limit] or None


def shape_scale(config: QuestionConfig, value: object) -> int | None:
    """Return a scale value inside the question's range."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not config.scale_min <= value <= config.scale_max:
        raise InvalidAnswerError
    return value


def allowed_keys(config: QuestionConfig) -> set[str]:
    """Return the option keys a participant may submit for this question."""
    keys = {option.key for option in config.options}
    if config.allow_other and config.kind is QuestionKind.CHOICE:
        keys.add(OTHER_KEY)
    return keys


def shape_choice(config: QuestionConfig, value: object) -> str | None:
    """Return one chosen option key."""
    if value is None or value == "":
        return None
    if not isinstance(value, str) or value not in allowed_keys(config):
        raise InvalidAnswerError
    return value


def shape_choices(config: QuestionConfig, value: object) -> list[str]:
    """Return the chosen option keys in the order the question lists them."""
    if value is None:
        return []
    if not isinstance(value, list) or not set(value) <= allowed_keys(config):
        raise InvalidAnswerError
    ordered = [option.key for option in config.options if option.key in value]
    return [*ordered, OTHER_KEY] if OTHER_KEY in value else ordered
