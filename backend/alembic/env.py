"""Alembic environment: migrations run against the app's own engine and SQLModel metadata."""

from sqlmodel import SQLModel

from alembic import context
from app import models  # noqa: F401 - importing registers every table on the metadata
from app.db import get_engine

target_metadata = SQLModel.metadata


def run_migrations() -> None:
    """Apply migrations. Batch mode is needed because SQLite cannot alter most columns in place."""
    with get_engine().connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
        connection.commit()


run_migrations()
