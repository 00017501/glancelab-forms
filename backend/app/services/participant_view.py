"""Build what a participant's browser receives: only the assigned variant's content."""

from sqlmodel import Session, col, select

from app.errors import NotFoundError
from app.models import ConsentVersion, Form, Image
from app.schemas.forms import FormContent
from app.schemas.participant import ConsentContent, ParticipantStep, PreviewPayload
from app.schemas.steps import (
    ClickImageConfig,
    ConsentConfig,
    DistractorConfig,
    QuestionConfig,
    StepConfig,
    StimulusConfig,
    TextConfig,
    TimedSearchConfig,
)
from app.services.images import image_url


def consent_content(session: Session, form: Form) -> ConsentContent:
    """Return the consent wording currently in force for a form."""
    stored = session.exec(
        select(ConsentVersion).where(ConsentVersion.form_id == form.id, ConsentVersion.version == form.consent_version)
    ).one()
    config = ConsentConfig.model_validate(stored.content)
    return ConsentContent(version=stored.version, **config.model_dump(exclude={"type"}))


def image_urls(session: Session, image_ids: set[int]) -> dict[int, str]:
    """Map image ids to the URLs that serve them."""
    if not image_ids:
        return {}
    images = session.exec(select(Image).where(col(Image.id).in_(image_ids))).all()
    return {image.id or 0: image_url(image.storage_key) for image in images}


def step_image_id(config: StepConfig, variant_key: str) -> int | None:
    """Return the one image this step shows to the given variant, if any."""
    if isinstance(config, StimulusConfig | TimedSearchConfig):
        return config.images.get(variant_key)
    if isinstance(config, ClickImageConfig):
        return config.image_id
    return None


def build_steps(
    session: Session, content: FormContent, variant_key: str, *, include_targets: bool = False
) -> list[ParticipantStep]:
    """Return the steps after consent as one variant sees them.

    Targets are included only for the admin's preview; a participant's browser never receives them.
    """
    steps = [step for step in content.steps if not isinstance(step.config, ConsentConfig)]
    wanted = {image_id for step in steps if (image_id := step_image_id(step.config, variant_key)) is not None}
    urls = image_urls(session, wanted)

    built: list[ParticipantStep] = []
    for step in steps:
        image_id = step_image_id(step.config, variant_key)
        view = ParticipantStep(
            key=step.key,
            type=step.config.type,
            required=step.required,
            image_url=urls.get(image_id) if image_id is not None else None,
        )
        built.append(view.model_copy(update=step_fields(step.config, variant_key, include_targets)))
    return built


def step_fields(config: StepConfig, variant_key: str, include_targets: bool) -> dict[str, object]:
    """Return the participant-visible settings of one step."""
    if isinstance(config, TextConfig):
        return config.model_dump(include={"title", "body_html", "button_label"})
    if isinstance(config, StimulusConfig):
        return {"duration_ms": config.duration_ms}
    if isinstance(config, DistractorConfig):
        return config.model_dump(include={"instruction", "duration_ms"})
    if isinstance(config, ClickImageConfig):
        return {"prompt": config.prompt}
    if isinstance(config, TimedSearchConfig):
        fields: dict[str, object] = config.model_dump(include={"instruction", "ready_label", "timeout_ms"})
        if include_targets:
            fields["target"] = config.targets.get(variant_key)
        return fields
    if isinstance(config, QuestionConfig):
        return {
            "kind": config.kind,
            "prompt": config.prompt,
            "help_text": config.help_text,
            "options": config.options,
            "multiple": config.multiple,
            "allow_other": config.allow_other,
            "scale_min": config.scale_min,
            "scale_max": config.scale_max,
            "scale_min_label": config.scale_min_label,
            "scale_max_label": config.scale_max_label,
        }
    return {}


def build_preview(session: Session, form: Form, content: FormContent, variant_key: str) -> PreviewPayload:
    """Return a form as one variant would see it, with targets, for the admin's preview. Stores nothing."""
    chosen = next((variant for variant in content.variants if variant.key == variant_key), None)
    if chosen is None:
        raise NotFoundError("That variant no longer exists.")
    return PreviewPayload(
        title=form.title,
        variant_label=chosen.label,
        consent=consent_content(session, form),
        steps=build_steps(session, content, chosen.key, include_targets=True),
    )
