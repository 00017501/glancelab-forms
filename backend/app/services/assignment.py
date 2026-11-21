"""Balanced random assignment of participants to variants."""

import random
from datetime import datetime, timedelta

from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.models import SessionStatus, StudySession, Variant


def choose_variant(counts: dict[int, int], rng: random.Random) -> int:
    """Return a variant with the lowest count, breaking ties at random."""
    lowest = min(counts.values())
    return rng.choice([variant_id for variant_id, count in counts.items() if count == lowest])


def count_by_variant(session: Session, form_id: int, active_since: datetime) -> dict[int, int]:
    """Count, per variant, sessions that finished or were last seen after the cutoff.

    Abandoned sessions stop counting once they pass the cutoff, so later participants refill their slot.
    """
    variant_ids = session.exec(select(Variant.id).where(Variant.form_id == form_id)).all()
    counted = session.exec(
        select(StudySession.variant_id, func.count())
        .where(
            StudySession.form_id == form_id,
            or_(
                col(StudySession.status) == SessionStatus.COMPLETED,
                col(StudySession.last_seen_at) >= active_since,
            ),
        )
        .group_by(col(StudySession.variant_id))
    ).all()
    counts = {variant_id: 0 for variant_id in variant_ids if variant_id is not None}
    counts.update({variant_id: count for variant_id, count in counted if variant_id in counts})
    return counts


def assign_variant(session: Session, form_id: int, now: datetime, active_minutes: int) -> int:
    """Pick the variant for a new session. Must run in the transaction that inserts the session."""
    counts = count_by_variant(session, form_id, now - timedelta(minutes=active_minutes))
    return choose_variant(counts, random.SystemRandom())
