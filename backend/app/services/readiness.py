"""Check whether a form has everything it needs before it can be published."""

from app.schemas.forms import FormContent, StepContent, VariantContent
from app.schemas.steps import (
    ClickImageConfig,
    ConsentConfig,
    QuestionConfig,
    QuestionKind,
    StimulusConfig,
    TextConfig,
    TimedSearchConfig,
)

STEP_NAMES = {
    "consent": "Consent",
    "text": "Text screen",
    "stimulus": "Ad exposure",
    "distractor": "Distractor",
    "question": "Question",
    "click_image": "Click on image",
    "timed_search": "Timed search",
}


def find_publish_problems(content: FormContent, known_image_ids: set[int]) -> list[str]:
    """Return plain-language reasons the form cannot be published yet; empty when it is ready."""
    problems: list[str] = []
    if len(content.steps) < 2:
        problems.append("Add at least one step after the consent step.")
    for number, step in enumerate(content.steps, start=1):
        label = f"Step {number} ({STEP_NAMES[step.config.type]})"
        problems.extend(f"{label}: {issue}" for issue in step_problems(step, content.variants, known_image_ids))
    return problems


def step_problems(step: StepContent, variants: list[VariantContent], known_image_ids: set[int]) -> list[str]:
    """Return what is missing from one step."""
    config = step.config
    if isinstance(config, ConsentConfig):
        return consent_problems(config)
    if isinstance(config, TextConfig):
        return [] if config.title.strip() or config.body_html.strip() else ["add a title or some text."]
    if isinstance(config, StimulusConfig):
        return variant_image_problems(config.images, variants, known_image_ids)
    if isinstance(config, TimedSearchConfig):
        issues = variant_image_problems(config.images, variants, known_image_ids)
        issues.extend(
            f'draw the target box for variant "{variant.label}".'
            for variant in variants
            if config.images.get(variant.key) in known_image_ids and config.targets.get(variant.key) is None
        )
        return issues
    if isinstance(config, ClickImageConfig):
        return [] if config.image_id in known_image_ids else ["choose an image."]
    if isinstance(config, QuestionConfig):
        return question_problems(config)
    return []


def consent_problems(config: ConsentConfig) -> list[str]:
    """Return which consent details are still empty."""
    issues: list[str] = []
    if not config.organiser.strip():
        issues.append("say who is running the study.")
    if not config.purpose.strip():
        issues.append("describe the purpose of the study.")
    if not config.contact.strip():
        issues.append("add a contact for questions.")
    if config.deletion_date is None:
        issues.append("set the date by which the data will be deleted.")
    for field in ("collected", "not_collected", "voluntary", "anonymity", "age"):
        if not getattr(config, field).strip():
            issues.append("one of the consent statements is empty.")
            break
    return issues


def variant_image_problems(
    images: dict[str, int | None], variants: list[VariantContent], known_image_ids: set[int]
) -> list[str]:
    """Return one problem per variant that has no usable image."""
    return [
        f'choose an image for variant "{variant.label}".'
        for variant in variants
        if images.get(variant.key) not in known_image_ids
    ]


def question_problems(config: QuestionConfig) -> list[str]:
    """Return what is missing from a question."""
    issues: list[str] = []
    if not config.prompt.strip():
        issues.append("write the question.")
    if config.kind in {QuestionKind.CHOICE, QuestionKind.DROPDOWN}:
        if len(config.options) < 2:
            issues.append("add at least two options.")
        labels = [option.label.strip().casefold() for option in config.options]
        if any(not label for label in labels):
            issues.append("an option is empty.")
        if len(set(labels)) != len(labels):
            issues.append("two options have the same wording; the results could not tell them apart.")
        if any("|" in label for label in labels):
            issues.append('remove the "|" character from the options; it separates answers in the results file.')
        if config.allow_other and "other" in labels:
            issues.append('an option is called "Other" and the built-in "Other" answer is also on; keep only one.')
    if config.kind is QuestionKind.SCALE and config.scale_max <= config.scale_min:
        issues.append("the scale's highest value must be above its lowest.")
    return issues
