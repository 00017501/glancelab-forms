"""Shared fixtures: a throwaway database, an in-memory object store and a logged-in client."""

import io
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

os.environ.update(
    ADMIN_USERNAME="researcher",
    ADMIN_PASSWORD="correct-horse-battery",
    SECRET_KEY="t" * 40,
    COOKIE_SECURE="false",
    STATIC_DIR="does-not-exist",
)

from fastapi.testclient import TestClient
from PIL import Image as PillowImage
from sqlalchemy import Engine
from sqlmodel import Session, SQLModel

from app.db import build_engine, get_session
from app.errors import NotFoundError
from app.main import app
from app.security import login_limiter
from app.storage.client import get_storage

ADMIN = {"username": "researcher", "password": "correct-horse-battery"}


class FakeStorage:
    """An object store that keeps everything in a dict."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.objects[key] = body

    def stream(self, key: str) -> tuple[Iterator[bytes], int]:
        if key not in self.objects:
            raise NotFoundError
        return iter([self.objects[key]]), len(self.objects[key])

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)


def make_png(width: int = 800, height: int = 600) -> bytes:
    """Return the bytes of a plain PNG."""
    buffer = io.BytesIO()
    PillowImage.new("RGB", (width, height), (200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def engine(tmp_path: Path) -> Engine:
    engine = build_engine(str(tmp_path / "test.db"))
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def anonymous(engine: Engine, storage: FakeStorage) -> Iterator[TestClient]:
    """A client with no admin cookie, as a participant's browser would be."""

    def session_per_request() -> Iterator[Session]:
        with Session(engine, expire_on_commit=False) as session:
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise

    app.dependency_overrides[get_session] = session_per_request
    app.dependency_overrides[get_storage] = lambda: storage
    login_limiter._failures.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def admin(anonymous: TestClient) -> TestClient:
    """A second client that is logged in as the admin."""
    client = TestClient(app)
    assert client.post("/api/admin/login", json=ADMIN).status_code == 200
    return client


def upload_image(admin: TestClient, name: str = "ad.png") -> int:
    """Upload one image and return its id."""
    response = admin.post("/api/admin/images", files=[("files", (name, make_png(), "image/png"))])
    assert response.status_code == 201, response.text
    return response.json()["uploaded"][0]["id"]


def full_content(form: dict[str, Any], image_ids: list[int]) -> dict[str, Any]:
    """Return editor content that uses every step type, for a form's existing variants."""
    variants = form["variants"]
    images = {variant["key"]: image_ids[index % len(image_ids)] for index, variant in enumerate(variants)}
    consent = form["steps"][0]
    consent["config"].update(
        organiser="Group 4, Neuromarketing module",
        purpose="We study how people look at adverts.",
        contact="group4@example.edu",
        deletion_date="2027-06-30",
    )
    box = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
    options = [{"key": "o1", "label": "£49"}, {"key": "o2", "label": "£59"}, {"key": "o3", "label": "£69"}]
    steps = [
        consent,
        {"key": "intro", "config": {"type": "text", "title": "Welcome", "body_html": "<p>Hello</p>"}},
        {"key": "ad", "config": {"type": "stimulus", "duration_ms": 3000, "images": images}},
        {"key": "sums", "config": {"type": "distractor", "duration_ms": 5000}},
        {
            "key": "recall",
            "config": {"type": "question", "kind": "choice", "prompt": "What was the price?", "options": options},
        },
        {
            "key": "seen",
            "required": False,
            "config": {
                "type": "question",
                "kind": "choice",
                "prompt": "What did you notice?",
                "options": options,
                "multiple": True,
                "allow_other": True,
            },
        },
        {"key": "liking", "config": {"type": "question", "kind": "scale", "prompt": "How much did you like it?"}},
        {"key": "why", "required": False, "config": {"type": "question", "kind": "paragraph", "prompt": "Why?"}},
        {"key": "look", "config": {"type": "click_image", "prompt": "Where did you look?", "image_id": image_ids[0]}},
        {
            "key": "find",
            "config": {"type": "timed_search", "images": images, "targets": dict.fromkeys(images, box)},
        },
        {"key": "bye", "config": {"type": "text", "title": "Thank you"}},
    ]
    return {"title": "Price placement", "block_repeats": True, "variants": variants, "steps": steps}


@pytest.fixture
def published(admin: TestClient) -> dict[str, Any]:
    """A published form with three variants and every step type."""
    form = admin.post("/api/admin/forms", json={"title": "Price placement"}).json()
    form["variants"].append({"key": "v3", "label": "C"})
    content = full_content(form, [upload_image(admin, "a.png"), upload_image(admin, "b.png")])
    saved = admin.put(f"/api/admin/forms/{form['id']}", json=content)
    assert saved.status_code == 200, saved.text
    result = admin.post(f"/api/admin/forms/{form['id']}/publish")
    assert result.status_code == 200, result.text
    return result.json()


def consent_body(version: int = 1) -> dict[str, Any]:
    return {
        "agreed": True,
        "consent_version": version,
        "device_type": "phone",
        "viewport_width": 390,
        "viewport_height": 844,
    }


def start(client: TestClient, slug: str, version: int = 1) -> dict[str, Any]:
    """Consent and return the new session state."""
    response = client.post(f"/api/p/studies/{slug}/sessions", json=consent_body(version))
    assert response.status_code == 201, response.text
    return response.json()


ANSWERS: dict[str, dict[str, Any]] = {
    "intro": {"type": "text"},
    "ad": {"type": "stimulus", "shown_ms": 3004},
    "sums": {"type": "distractor", "attempted": 6, "correct": 5},
    "recall": {"type": "question", "value": "o2"},
    "seen": {"type": "question", "value": ["o3", "__other__", "o1"], "other": "=the sofa"},
    "liking": {"type": "question", "value": 6},
    "why": {"type": "question", "value": None},
    "look": {"type": "click_image", "x": 0.5, "y": 0.25, "pointer": "touch"},
    "find": {"type": "timed_search", "rt_ms": 1432, "x": 0.15, "y": 0.2, "pointer": "touch"},
    "bye": {"type": "text"},
}
TIMED = {"ad", "sums", "find"}


def run_to_end(client: TestClient, state: dict[str, Any], stop_before: str | None = None) -> dict[str, Any]:
    """Answer every remaining step in order, optionally stopping before one."""
    token = state["token"]
    while state["next_index"] is not None:
        key = state["steps"][state["next_index"]]["key"]
        if key == stop_before:
            break
        if key in TIMED:
            assert client.post(f"/api/p/sessions/{token}/steps/{key}/start").status_code == 204
        response = client.post(f"/api/p/sessions/{token}/steps/{key}/finish", json={"result": ANSWERS[key]})
        assert response.status_code == 200, response.text
        state = response.json()
    return state
