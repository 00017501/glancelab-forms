"""Flatten a form's responses into one CSV row per participant, plus a codebook for the columns."""

import csv
import io
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session, col, select

from app.models import ResultStatus, SessionStatus, Step, StepResult, StudySession, Variant
from app.schemas.results import OTHER_KEY
from app.schemas.steps import (
    ClickImageConfig,
    DistractorConfig,
    QuestionConfig,
    StepConfig,
    StimulusConfig,
    TimedSearchConfig,
    parse_step_config,
)
from app.utils import as_utc

SESSION_COLUMNS = (
    ("participant_id", "Anonymous random ID"),
    ("variant", "Ad variant this participant was assigned"),
    ("status", "completed, or partial when the participant did not reach the end"),
    ("interrupted", "1 when the page was reloaded during a timed step; consider excluding"),
    ("device_type", "phone, tablet or desktop"),
    ("viewport_width", "Browser window width in CSS pixels"),
    ("viewport_height", "Browser window height in CSS pixels"),
    ("user_agent", "Browser user-agent string"),
    ("consent_at", "UTC time consent was given"),
    ("consent_version", "Version of the consent text that was shown"),
    ("started_at", "UTC start time"),
    ("completed_at", "UTC finish time, empty when partial"),
    ("duration_s", "Seconds from start to finish, empty when partial"),
)
# Spreadsheet programs run a cell that starts with one of these as a formula.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
# Joins several chosen options in one cell.
MULTI_SEPARATOR = " | "


@dataclass(frozen=True)
class StepColumn:
    """One CSV column that comes from a step's result."""

    name: str
    step_id: int
    field: str
    description: str
    config: StepConfig


def step_fields(config: StepConfig) -> list[tuple[str, str, str]]:
    """Return (column suffix, result field, description) for each value a step type records."""
    if isinstance(config, StimulusConfig):
        return [
            ("stimulus_shown_ms", "shown_ms", f"Milliseconds the ad was on screen (set to {config.duration_ms})"),
            ("stimulus_status", "__status", "done, or interrupted when the page was reloaded"),
        ]
    if isinstance(config, DistractorConfig):
        return [
            ("distractor_attempted", "attempted", "Sums answered"),
            ("distractor_correct", "correct", "Sums answered correctly"),
        ]
    if isinstance(config, QuestionConfig):
        fields = [("answer", "value", config.prompt)]
        if config.allow_other:
            fields.append(("answer_other", "other", f'Text typed for "Other": {config.prompt}'))
        return fields
    if isinstance(config, ClickImageConfig):
        return [
            ("click_x", "x", f"Horizontal click position, 0 left to 1 right: {config.prompt}"),
            ("click_y", "y", "Vertical click position, 0 top to 1 bottom"),
            ("click_pointer", "pointer", "mouse, touch or pen"),
        ]
    if isinstance(config, TimedSearchConfig):
        return [
            ("search_outcome", "outcome", f"hit, miss, timeout or interrupted: {config.instruction}"),
            ("search_rt_ms", "rt_ms", "Milliseconds from the image appearing to the click"),
            ("search_x", "x", "Horizontal click position, 0 left to 1 right"),
            ("search_y", "y", "Vertical click position, 0 top to 1 bottom"),
            ("search_hit", "hit", "1 when the click landed inside the target box, else 0"),
            ("search_pointer", "pointer", "mouse, touch or pen"),
        ]
    return []


def build_columns(steps: list[Step]) -> list[StepColumn]:
    """Return the step columns in form order. Names depend only on position and type, never on wording."""
    columns: list[StepColumn] = []
    for step in steps:
        config = parse_step_config(step.config)
        prefix = f"s{step.position + 1:02d}"
        columns.extend(
            StepColumn(f"{prefix}_{suffix}", step.id or 0, field, description, config)
            for suffix, field, description in step_fields(config)
        )
    return columns


def option_label(config: QuestionConfig, key: str) -> str:
    """Return the wording of an option, so the CSV is readable without the codebook."""
    if key == OTHER_KEY:
        return "Other"
    return next((option.label for option in config.options if option.key == key), key)


def cell(column: StepColumn, result: StepResult | None) -> str:
    """Return the text of one cell; empty when the step has no value."""
    if result is None:
        return ""
    if column.field == "__status":
        return result.status.value
    if column.field == "outcome" and result.status is ResultStatus.INTERRUPTED:
        return "interrupted"

    value: Any = result.data.get(column.field)
    if value is None:
        return ""
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(column.config, QuestionConfig) and column.field == "value" and column.config.options:
        keys = value if isinstance(value, list) else [value]
        return safe_text(MULTI_SEPARATOR.join(option_label(column.config, str(key)) for key in keys))
    return safe_text(str(value))


def safe_text(text: str) -> str:
    """Neutralise text that a spreadsheet would otherwise run as a formula."""
    return f"'{text}" if text.startswith(FORMULA_PREFIXES) else text


def session_cells(study_session: StudySession, variant_label: str) -> list[str]:
    """Return the fixed leading cells of a row."""
    completed = study_session.completed_at
    duration = (as_utc(completed) - as_utc(study_session.started_at)).total_seconds() if completed else None
    return [
        study_session.public_id,
        safe_text(variant_label),
        "completed" if study_session.status is SessionStatus.COMPLETED else "partial",
        "1" if study_session.interrupted else "0",
        study_session.device_type,
        str(study_session.viewport_width),
        str(study_session.viewport_height),
        safe_text(study_session.user_agent),
        as_utc(study_session.consent_at).isoformat(timespec="seconds"),
        str(study_session.consent_version),
        as_utc(study_session.started_at).isoformat(timespec="seconds"),
        as_utc(completed).isoformat(timespec="seconds") if completed else "",
        f"{duration:.1f}" if duration is not None else "",
    ]


def load_form_data(
    session: Session, form_id: int
) -> tuple[list[Step], dict[int, str], list[StudySession], dict[int, dict[int, StepResult]]]:
    """Read a form's steps, variant labels, sessions and results grouped by session."""
    steps = session.exec(select(Step).where(Step.form_id == form_id).order_by(col(Step.position))).all()
    variants = session.exec(select(Variant).where(Variant.form_id == form_id)).all()
    sessions = session.exec(
        select(StudySession).where(StudySession.form_id == form_id).order_by(col(StudySession.started_at))
    ).all()
    results = session.exec(
        select(StepResult)
        .join(StudySession, col(StudySession.id) == col(StepResult.session_id))
        .where(StudySession.form_id == form_id)
    ).all()

    grouped: dict[int, dict[int, StepResult]] = {}
    for result in results:
        grouped.setdefault(result.session_id, {})[result.step_id] = result
    return list(steps), {variant.id or 0: variant.label for variant in variants}, list(sessions), grouped


def export_csv(session: Session, form_id: int) -> str:
    """Return the responses of a form as CSV text, one row per participant."""
    steps, variant_labels, sessions, grouped = load_form_data(session, form_id)
    columns = build_columns(steps)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([name for name, _ in SESSION_COLUMNS] + [column.name for column in columns])
    for study_session in sessions:
        results = grouped.get(study_session.id or 0, {})
        writer.writerow(
            session_cells(study_session, variant_labels.get(study_session.variant_id, ""))
            + [cell(column, results.get(column.step_id)) for column in columns]
        )
    return buffer.getvalue()


def export_codebook(session: Session, form_id: int) -> str:
    """Return a CSV that explains every column of the responses export."""
    steps = session.exec(select(Step).where(Step.form_id == form_id).order_by(col(Step.position))).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["column", "meaning", "possible_values"])
    for name, description in SESSION_COLUMNS:
        writer.writerow([name, description, ""])
    for column in build_columns(list(steps)):
        values = ""
        if isinstance(column.config, QuestionConfig) and column.field == "value":
            values = possible_values(column.config)
        writer.writerow([column.name, safe_text(column.description), safe_text(values)])
    return buffer.getvalue()


def possible_values(config: QuestionConfig) -> str:
    """Describe the answers a question can produce."""
    if config.options:
        return MULTI_SEPARATOR.join(option.label for option in config.options)
    if config.kind.value == "scale":
        low = f" ({config.scale_min_label})" if config.scale_min_label else ""
        high = f" ({config.scale_max_label})" if config.scale_max_label else ""
        return f"{config.scale_min}{low} to {config.scale_max}{high}"
    return "free text"
