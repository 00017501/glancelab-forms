"""Decide whether an edit changes what a form collects, or only its wording."""

from typing import Any

from app.schemas.forms import FormContent


def form_structure(content: FormContent) -> dict[str, Any]:
    """Return the parts of a form that determine the data it collects and how the CSV is shaped."""
    return {
        "variants": [variant.key for variant in content.variants],
        "steps": [
            {"key": step.key, "required": step.required, "config": step.config.structure()} for step in content.steps
        ],
    }


def is_text_only_change(current: FormContent, proposed: FormContent) -> bool:
    """Return whether the proposed content differs from the current one in wording alone."""
    return form_structure(current) == form_structure(proposed)
