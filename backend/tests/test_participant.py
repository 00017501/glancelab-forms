"""Consent, assignment, interruption and withdrawal: the rules the consent text promises."""

import csv
import io
import json
import random
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.models import StepResult, StudySession
from app.services.assignment import choose_variant
from tests.conftest import consent_body, run_to_end, start


def count_rows(engine: Engine) -> tuple[int, int]:
    with Session(engine) as session:
        return len(session.exec(select(StudySession)).all()), len(session.exec(select(StepResult)).all())


def read_csv(admin: TestClient, form_id: int) -> list[dict[str, str]]:
    text = admin.get(f"/api/admin/forms/{form_id}/responses.csv").text.lstrip("﻿")
    return list(csv.DictReader(io.StringIO(text)))


def test_choose_variant_prefers_the_emptiest() -> None:
    assert choose_variant({1: 4, 2: 3, 3: 4}, random.Random(0)) == 2


def test_choose_variant_breaks_ties_at_random() -> None:
    picks = {choose_variant({1: 0, 2: 0, 3: 0}, random.Random(seed)) for seed in range(40)}
    assert picks == {1, 2, 3}


def test_reading_the_consent_page_stores_nothing(
    anonymous: TestClient, published: dict[str, Any], engine: Engine
) -> None:
    info = anonymous.get(f"/api/p/studies/{published['slug']}").json()

    assert info["is_open"] is True
    assert "IP address" in info["consent"]["not_collected"]
    assert count_rows(engine) == (0, 0)


def test_declining_consent_stores_nothing(anonymous: TestClient, published: dict[str, Any], engine: Engine) -> None:
    body = consent_body() | {"agreed": False}

    response = anonymous.post(f"/api/p/studies/{published['slug']}/sessions", json=body)

    assert response.status_code == 422
    assert count_rows(engine) == (0, 0)


def test_session_stores_consent_time_and_version_but_no_address(
    anonymous: TestClient, published: dict[str, Any], engine: Engine
) -> None:
    start(anonymous, published["slug"])

    with Session(engine) as session:
        stored = session.exec(select(StudySession)).one()
    assert stored.consent_version == 1
    assert stored.consent_at is not None
    # The test client's address and its user agent are both "testclient"; only the user agent may be kept.
    assert stored.user_agent == "testclient"
    assert "testclient" not in json.dumps(stored.model_dump(mode="json", exclude={"user_agent"}))
    assert not {"ip", "ip_address", "address"} & set(stored.model_dump())


def test_simultaneous_starts_are_balanced_across_variants(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any]
) -> None:
    with ThreadPoolExecutor(max_workers=15) as pool:
        list(pool.map(lambda _: start(anonymous, published["slug"]), range(30)))

    variants = Counter(row["variant"] for row in read_csv(admin, published["id"]))
    assert variants == {"A": 10, "B": 10, "C": 10}


def test_participant_receives_only_their_variant(anonymous: TestClient, published: dict[str, Any]) -> None:
    state = start(anonymous, published["slug"])

    payload = json.dumps(state)
    stimulus = next(step for step in state["steps"] if step["type"] == "stimulus")
    assert stimulus["image_url"].startswith("/img/")
    assert all(step["target"] is None for step in state["steps"])
    assert "variant" not in payload
    assert payload.count("/img/") == 3


def test_reload_during_stimulus_never_replays_it(anonymous: TestClient, published: dict[str, Any]) -> None:
    state = run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="ad")
    token = state["token"]
    assert anonymous.post(f"/api/p/sessions/{token}/steps/ad/start").status_code == 204

    resumed = anonymous.get(f"/api/p/sessions/{token}").json()

    assert resumed["interrupted"] is True
    assert resumed["steps"][resumed["next_index"]]["key"] == "sums"
    again = anonymous.post(f"/api/p/sessions/{token}/steps/ad/start")
    late = anonymous.post(
        f"/api/p/sessions/{token}/steps/ad/finish", json={"result": {"type": "stimulus", "shown_ms": 1}}
    )
    assert again.status_code == 409
    assert late.status_code == 409


def test_timed_step_cannot_finish_without_being_started(anonymous: TestClient, published: dict[str, Any]) -> None:
    state = run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="ad")

    response = anonymous.post(
        f"/api/p/sessions/{state['token']}/steps/ad/finish", json={"result": {"type": "stimulus", "shown_ms": 3000}}
    )

    assert response.status_code == 409


def test_steps_cannot_be_skipped(anonymous: TestClient, published: dict[str, Any]) -> None:
    state = start(anonymous, published["slug"])

    response = anonymous.post(
        f"/api/p/sessions/{state['token']}/steps/recall/finish", json={"result": {"type": "question", "value": "o1"}}
    )

    assert response.status_code == 409


def test_required_question_needs_an_answer(anonymous: TestClient, published: dict[str, Any]) -> None:
    state = run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="recall")
    url = f"/api/p/sessions/{state['token']}/steps/recall/finish"

    empty = anonymous.post(url, json={"result": {"type": "question", "value": None}})
    unknown = anonymous.post(url, json={"result": {"type": "question", "value": "nope"}})

    assert empty.status_code == 422
    assert unknown.status_code == 422


def test_withdrawing_deletes_everything(anonymous: TestClient, published: dict[str, Any], engine: Engine) -> None:
    state = run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="look")
    assert count_rows(engine)[1] > 0

    assert anonymous.delete(f"/api/p/sessions/{state['token']}").status_code == 204

    assert count_rows(engine) == (0, 0)
    assert anonymous.get(f"/api/p/sessions/{state['token']}").status_code == 404


def test_completed_run_exports_one_clean_row(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any]
) -> None:
    final = run_to_end(anonymous, start(anonymous, published["slug"]))
    assert final["next_index"] is None

    rows = read_csv(admin, published["id"])

    assert len(rows) == 1
    row = rows[0]
    assert row["participant_id"] == final["participant_id"]
    assert row["status"] == "completed"
    assert row["interrupted"] == "0"
    assert row["device_type"] == "phone"
    assert row["s03_stimulus_shown_ms"] == "3004"
    assert row["s04_distractor_correct"] == "5"
    assert row["s05_answer"] == "£59"
    assert row["s06_answer"] == "£49 | £69 | Other"
    assert row["s06_answer_other"] == "'=the sofa"
    assert row["s07_answer"] == "6"
    assert row["s08_answer"] == ""
    assert (row["s09_click_x"], row["s09_click_y"], row["s09_click_pointer"]) == ("0.5", "0.25", "touch")
    assert (row["s10_search_outcome"], row["s10_search_rt_ms"], row["s10_search_hit"]) == ("hit", "1432", "1")
    assert "token" not in row
    assert final["token"] not in json.dumps(rows)


def test_timeout_and_miss_are_scored_on_the_server(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any]
) -> None:
    outcomes = []
    for result in (
        {"type": "timed_search", "rt_ms": None},
        {"type": "timed_search", "rt_ms": 900, "x": 0.9, "y": 0.9, "pointer": "mouse"},
    ):
        state = run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="find")
        token = state["token"]
        anonymous.post(f"/api/p/sessions/{token}/steps/find/start")
        anonymous.post(f"/api/p/sessions/{token}/steps/find/finish", json={"result": result})
    outcomes = [row["s10_search_outcome"] for row in read_csv(admin, published["id"])]

    assert sorted(outcomes) == ["miss", "timeout"]


def test_closed_study_takes_no_new_participants(
    anonymous: TestClient, admin: TestClient, published: dict[str, Any]
) -> None:
    under_way = start(anonymous, published["slug"])
    admin.post(f"/api/admin/forms/{published['id']}/close")

    refused = anonymous.post(f"/api/p/studies/{published['slug']}/sessions", json=consent_body())
    finished = run_to_end(anonymous, under_way)

    assert refused.status_code == 410
    assert anonymous.get(f"/api/p/studies/{published['slug']}").json()["is_open"] is False
    assert finished["next_index"] is None


def test_draft_link_is_not_public(anonymous: TestClient, admin: TestClient) -> None:
    draft = admin.post("/api/admin/forms", json={"title": "Draft"}).json()

    assert anonymous.get(f"/api/p/studies/{draft['slug']}").status_code == 404


def test_repeated_start_is_accepted_until_the_page_reloads(anonymous: TestClient, published: dict[str, Any]) -> None:
    state = run_to_end(anonymous, start(anonymous, published["slug"]), stop_before="ad")
    url = f"/api/p/sessions/{state['token']}/steps/ad/start"

    first, repeated = anonymous.post(url), anonymous.post(url)
    finished = anonymous.post(
        f"/api/p/sessions/{state['token']}/steps/ad/finish", json={"result": {"type": "stimulus", "shown_ms": 3000}}
    )

    assert (first.status_code, repeated.status_code, finished.status_code) == (204, 204, 200)
    assert finished.json()["interrupted"] is False
    assert anonymous.post(url).status_code == 409
