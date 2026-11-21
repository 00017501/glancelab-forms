"""The admin's view of a form's responses."""

from sqlmodel import Session

from app.models import SessionStatus
from app.schemas.admin import ResponseList, ResponseRow, VariantCount
from app.schemas.steps import StepType
from app.services.export import load_form_data
from app.utils import as_utc


def list_responses(session: Session, form_id: int) -> ResponseList:
    """Return one row per session and the per-variant totals."""
    steps, variant_labels, sessions, grouped = load_form_data(session, form_id)
    steps_total = sum(1 for step in steps if step.type != StepType.CONSENT)
    counts = {label: VariantCount(label=label, completed=0, partial=0) for label in variant_labels.values()}

    rows: list[ResponseRow] = []
    for study_session in sessions:
        label = variant_labels.get(study_session.variant_id, "")
        completed = study_session.status is SessionStatus.COMPLETED
        if label in counts:
            counts[label].completed += completed
            counts[label].partial += not completed
        finished = study_session.completed_at
        rows.append(
            ResponseRow(
                participant_id=study_session.public_id,
                variant=label,
                status=study_session.status,
                interrupted=study_session.interrupted,
                device_type=study_session.device_type,
                viewport_width=study_session.viewport_width,
                viewport_height=study_session.viewport_height,
                started_at=as_utc(study_session.started_at),
                completed_at=as_utc(finished) if finished else None,
                duration_seconds=(
                    (as_utc(finished) - as_utc(study_session.started_at)).total_seconds() if finished else None
                ),
                steps_done=len(grouped.get(study_session.id or 0, {})),
                steps_total=steps_total,
            )
        )
    rows.reverse()
    return ResponseList(rows=rows, variants=list(counts.values()))
