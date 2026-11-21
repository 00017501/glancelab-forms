"""Small shared helpers: time and random identifiers."""

import secrets
from datetime import UTC, datetime

# No vowels or look-alike characters, so a random ID never spells a word and is easy to read aloud.
ID_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ"


def utc_now() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """Attach UTC to a datetime that SQLite returned without a timezone."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def random_code(length: int) -> str:
    """Return a random, human-readable code of the given length."""
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(length))


def random_key() -> str:
    """Return a stable client-style key for a new step, variant or option."""
    return secrets.token_hex(6)
