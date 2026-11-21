"""Database engine and the request-scoped session dependency."""

from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import Engine, event
from sqlmodel import Session, create_engine

from app.settings import get_settings


def build_engine(database_path: str) -> Engine:
    """Create a SQLite engine in WAL mode whose transactions take the write lock up front."""
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False, "timeout": 15})

    @event.listens_for(engine, "connect")
    def configure_connection(dbapi_connection: Any, _record: Any) -> None:
        # The driver's implicit BEGIN is deferred; switching it off lets the listener below choose the mode.
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=15000")
        cursor.close()

    @event.listens_for(engine, "begin")
    def begin_immediate(connection: Any) -> None:
        # Variant assignment reads counts and inserts in one transaction; IMMEDIATE makes that atomic.
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    return engine


@lru_cache
def get_engine() -> Engine:
    """Return the process-wide engine, creating the data folder on first use."""
    path = get_settings().database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return build_engine(str(path))


def get_session() -> Iterator[Session]:
    """Yield a session that commits on clean exit and rolls back on error."""
    with Session(get_engine(), expire_on_commit=False) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


DbSession = Annotated[Session, Depends(get_session)]
