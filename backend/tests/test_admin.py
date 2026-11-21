"""Admin access, the editing rules, images and deletion."""

import copy
from typing import Any

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.errors import ImageTooLargeError, InvalidImageError
from app.main import app
from app.models import ConsentVersion, StudySession
from app.routers.admin import auth as admin_auth
from app.routers.admin import forms as admin_forms
from app.routers.admin import images as admin_images
from app.routers.admin import responses as admin_responses
from app.schemas.steps import TargetBox
from app.services.answers import is_hit
from app.services.images import process_image
from app.settings import get_settings
from tests.conftest import ADMIN, FakeStorage, make_png, run_to_end, start, upload_image

ADMIN_ROUTES = [
    ("get", "/api/admin/me"),
    ("get", "/api/admin/forms"),
    ("post", "/api/admin/forms"),
    ("get", "/api/admin/forms/1"),
    ("put", "/api/admin/forms/1"),
    ("delete", "/api/admin/forms/1"),
    ("post", "/api/admin/forms/1/duplicate"),
    ("post", "/api/admin/forms/1/publish"),
    ("post", "/api/admin/forms/1/close"),
    ("get", "/api/admin/forms/1/preview?variant=a"),
    ("get", "/api/admin/images"),
    ("post", "/api/admin/images"),
    ("delete", "/api/admin/images/1"),
    ("get", "/api/admin/forms/1/responses"),
    ("get", "/api/admin/forms/1/responses.csv"),
    ("get", "/api/admin/forms/1/codebook.csv"),
    ("delete", "/api/admin/forms/1/responses"),
    ("delete", "/api/admin/forms/1/responses/ABC"),
    ("post", "/api/admin/wipe"),
]


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_routes_need_a_login(anonymous: TestClient, method: str, path: str) -> None:
    assert anonymous.request(method, path).status_code == 401


def test_every_admin_route_is_covered_by_the_login_test() -> None:
    routers = (admin_auth.router, admin_forms.router, admin_images.router, admin_responses.router)
    declared = {
        (method.lower(), route.path)
        for router in routers
        for route in router.routes
        if isinstance(route, APIRoute)
        for method in (route.methods or set()) - {"HEAD", "OPTIONS"}
    }
    open_routes = {("post", "/api/admin/login"), ("post", "/api/admin/logout")}
    assert len(declared - open_routes) == len(ADMIN_ROUTES)


def test_login_rejects_wrong_password_then_locks_out(anonymous: TestClient) -> None:
    wrong = ADMIN | {"password": "not-the-password"}

    statuses = [anonymous.post("/api/admin/login", json=wrong).status_code for _ in range(6)]

    assert statuses == [401, 401, 401, 401, 401, 429]
    assert anonymous.post("/api/admin/login", json=ADMIN).status_code == 429


def test_login_cookie_is_locked_down(anonymous: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: get_settings().model_copy(update={"cookie_secure": True})

    cookie = anonymous.post("/api/admin/login", json=ADMIN).headers["set-cookie"].lower()

    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=strict" in cookie


def test_new_form_starts_with_consent_and_cannot_lose_it(admin: TestClient) -> None:
    form = admin.post("/api/admin/forms", json={"title": "Study"}).json()
    assert [step["config"]["type"] for step in form["steps"]] == ["consent"]
    text_step = {"key": "t1", "config": {"type": "text", "title": "Hi"}}

    removed = admin.put(f"/api/admin/forms/{form['id']}", json=form | {"steps": [text_step]})
    moved = admin.put(f"/api/admin/forms/{form['id']}", json=form | {"steps": [text_step, form["steps"][0]]})

    assert removed.status_code == 422
    assert moved.status_code == 422


def test_incomplete_form_cannot_be_published(admin: TestClient) -> None:
    form = admin.post("/api/admin/forms", json={"title": "Study"}).json()

    response = admin.post(f"/api/admin/forms/{form['id']}/publish")

    assert response.status_code == 422
    assert any("who is running" in problem for problem in response.json()["details"])


def test_published_form_accepts_wording_but_not_structure(admin: TestClient, published: dict[str, Any]) -> None:
    url = f"/api/admin/forms/{published['id']}"
    reworded = copy.deepcopy(published)
    reworded["steps"][4]["config"]["prompt"] = "What price did the advert show?"
    reworded["steps"][4]["config"]["options"][0]["label"] = "49 pounds"
    reworded["variants"][0]["label"] = "Top left"

    structural: list[dict[str, Any]] = [copy.deepcopy(published) for _ in range(6)]
    structural[0]["steps"].pop(3)
    structural[1]["steps"][2]["config"]["duration_ms"] = 9000
    structural[2]["steps"][4]["config"]["options"].pop()
    structural[3]["variants"].pop()
    structural[4]["steps"][9]["config"]["targets"][published["variants"][0]["key"]]["x"] = 0.5
    structural[5]["steps"][3], structural[5]["steps"][4] = structural[5]["steps"][4], structural[5]["steps"][3]

    assert admin.put(url, json=reworded).status_code == 200
    assert [admin.put(url, json=content).status_code for content in structural] == [409] * 6


def test_structure_unlocks_only_after_closing_and_clearing(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any]
) -> None:
    url = f"/api/admin/forms/{published['id']}"
    start(anonymous, published["slug"])
    changed = copy.deepcopy(published)
    changed["steps"].pop(3)

    admin.post(f"{url}/close")
    still_locked = admin.put(url, json=changed).status_code
    cleared = admin.delete(f"{url}/responses").json()
    unlocked = admin.put(url, json=changed).status_code

    assert (still_locked, cleared, unlocked) == (409, {"deleted": 1}, 200)


def test_consent_rewording_is_versioned_once_someone_has_seen_it(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any], engine: Engine
) -> None:
    start(anonymous, published["slug"])
    reworded = copy.deepcopy(published)
    reworded["steps"][0]["config"]["purpose"] = "A clearer description of the purpose."

    saved = admin.put(f"/api/admin/forms/{published['id']}", json=reworded).json()
    stale = anonymous.post(
        f"/api/p/studies/{published['slug']}/sessions",
        json={
            "agreed": True,
            "consent_version": 1,
            "device_type": "desktop",
            "viewport_width": 1,
            "viewport_height": 1,
        },
    )

    assert saved["consent_version"] == 2
    assert stale.status_code == 422
    with Session(engine) as session:
        versions = session.exec(select(ConsentVersion).order_by(ConsentVersion.version)).all()  # pyright: ignore[reportArgumentType]
        assert [version.version for version in versions] == [1, 2]
        assert versions[0].content["purpose"] == "We study how people look at adverts."
        assert session.exec(select(StudySession)).one().consent_version == 1


def test_rich_text_is_sanitised(admin: TestClient) -> None:
    form = admin.post("/api/admin/forms", json={"title": "Study"}).json()
    form["steps"].append(
        {
            "key": "t1",
            "config": {"type": "text", "body_html": '<p onclick="x()">Hi<script>alert(1)</script><img src=x></p>'},
        }
    )

    saved = admin.put(f"/api/admin/forms/{form['id']}", json=form).json()

    assert saved["steps"][1]["config"]["body_html"] == "<p>Hi</p>"


def test_duplicate_copies_structure_without_responses(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any]
) -> None:
    run_to_end(anonymous, start(anonymous, published["slug"]))

    copy_of = admin.post(f"/api/admin/forms/{published['id']}/duplicate").json()

    assert copy_of["status"] == "draft"
    assert copy_of["slug"] != published["slug"]
    assert copy_of["response_count"] == 0
    assert [step["key"] for step in copy_of["steps"]] == [step["key"] for step in published["steps"]]
    assert copy_of["structure_locked"] is False


def test_preview_includes_targets_and_stores_nothing(
    admin: TestClient, published: dict[str, Any], engine: Engine
) -> None:
    variant = published["variants"][1]

    preview = admin.get(f"/api/admin/forms/{published['id']}/preview", params={"variant": variant["key"]}).json()

    search = next(step for step in preview["steps"] if step["type"] == "timed_search")
    assert preview["variant_label"] == "B"
    assert search["target"] == {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
    with Session(engine) as session:
        assert session.exec(select(StudySession)).all() == []


def test_upload_resizes_and_reports_bad_files(admin: TestClient, storage: FakeStorage) -> None:
    files = [
        ("files", ("big.png", make_png(4000, 3000), "image/png")),
        ("files", ("notes.png", b"this is not an image", "image/png")),
    ]

    outcome = admin.post("/api/admin/images", files=files).json()

    assert [image["filename"] for image in outcome["uploaded"]] == ["big.png"]
    assert (outcome["uploaded"][0]["width"], outcome["uploaded"][0]["height"]) == (2400, 1800)
    assert [failure["filename"] for failure in outcome["failed"]] == ["notes.png"]
    assert len(storage.objects) == 2
    served = admin.get(outcome["uploaded"][0]["url"])
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"


def test_process_image_rejects_oversized_and_unsupported_files() -> None:
    settings = get_settings().model_copy(update={"max_upload_mb": 1})

    with pytest.raises(ImageTooLargeError):
        process_image(b"x" * (1024 * 1024 + 1), settings)
    with pytest.raises(InvalidImageError):
        process_image(b"GIF89a" + b"\x00" * 64, settings)


def test_image_in_use_cannot_be_deleted(admin: TestClient, published: dict[str, Any], storage: FakeStorage) -> None:
    library = admin.get("/api/admin/images").json()
    used = next(image for image in library["images"] if image["used_by"])
    spare = upload_image(admin, "spare.png")

    assert admin.delete(f"/api/admin/images/{used['id']}").status_code == 409
    assert admin.delete(f"/api/admin/images/{spare}").status_code == 204
    assert len(storage.objects) == 4


def test_image_route_only_serves_generated_keys(anonymous: TestClient) -> None:
    assert anonymous.get("/img/..%2F..%2Fetc%2Fpasswd").status_code == 404
    assert anonymous.get("/img/" + "a" * 32 + ".webp").status_code == 404


def test_single_response_delete_and_full_wipe(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any], storage: FakeStorage
) -> None:
    first = run_to_end(anonymous, start(anonymous, published["slug"]))
    start(anonymous, published["slug"])
    url = f"/api/admin/forms/{published['id']}/responses"

    one = admin.delete(f"{url}/{first['participant_id']}").json()
    refused = admin.post("/api/admin/wipe", json={"confirmation": "yes"})
    wiped = admin.post("/api/admin/wipe", json={"confirmation": "DELETE EVERYTHING", "include_forms_and_images": True})

    assert one == {"deleted": 1}
    assert refused.status_code == 422
    assert wiped.json() == {"deleted": 1}
    assert admin.get("/api/admin/forms").json() == []
    assert storage.objects == {}


def test_deleting_a_form_removes_its_responses(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any], engine: Engine
) -> None:
    run_to_end(anonymous, start(anonymous, published["slug"]))

    assert admin.delete(f"/api/admin/forms/{published['id']}").status_code == 204

    with Session(engine) as session:
        assert session.exec(select(StudySession)).all() == []


def test_responses_table_and_codebook(anonymous: TestClient, admin: TestClient, published: dict[str, Any]) -> None:
    run_to_end(anonymous, start(anonymous, published["slug"]))
    run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="recall")

    table = admin.get(f"/api/admin/forms/{published['id']}/responses").json()
    codebook = admin.get(f"/api/admin/forms/{published['id']}/codebook.csv").text

    assert sorted(row["status"] for row in table["rows"]) == ["active", "completed"]
    assert sum(variant["completed"] + variant["partial"] for variant in table["variants"]) == 2
    assert "s05_answer,What was the price?,£49 | £59 | £69" in codebook
    assert set(table["rows"][0]) == {
        "participant_id",
        "variant",
        "status",
        "interrupted",
        "device_type",
        "viewport_width",
        "viewport_height",
        "started_at",
        "completed_at",
        "duration_seconds",
        "steps_done",
        "steps_total",
    }


def test_hit_test_uses_the_box_edges() -> None:
    box = TargetBox(x=0.2, y=0.2, w=0.2, h=0.1)

    assert is_hit(0.2, 0.2, box)
    assert is_hit(0.4, 0.3, box)
    assert not is_hit(0.41, 0.25, box)
    assert not is_hit(0.3, 0.31, box)


def test_unset_image_entries_do_not_count_as_structure(admin: TestClient, published: dict[str, Any]) -> None:
    reworded = copy.deepcopy(published)
    reworded["steps"][2]["config"]["images"]["never-a-variant"] = None
    reworded["steps"][1]["config"]["title"] = "Hello"

    assert admin.put(f"/api/admin/forms/{published['id']}", json=reworded).status_code == 200


def test_ambiguous_options_block_publishing(admin: TestClient) -> None:
    form = admin.post("/api/admin/forms", json={"title": "Study"}).json()
    options = [{"key": "a", "label": "Yes"}, {"key": "b", "label": "yes "}, {"key": "c", "label": "=1|2"}]
    form["steps"].append(
        {"key": "q", "config": {"type": "question", "kind": "choice", "prompt": "Noticed?", "options": options}}
    )
    admin.put(f"/api/admin/forms/{form['id']}", json=form)

    details = admin.post(f"/api/admin/forms/{form['id']}/publish").json()["details"]

    assert any("same wording" in problem for problem in details)
    assert any("separates answers" in problem for problem in details)
