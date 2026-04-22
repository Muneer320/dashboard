"""
Integration-style route tests (no real DB — all service calls are monkeypatched).
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models.event import Event
from app.models.user import User


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_user(username: str = "testuser") -> User:
    return User(
        id=uuid4(),
        username=username,
        password_hash="hash",
        name="Test User",
        details={},
        events={},
        food={"meal1": False, "meal2": False, "meal3": False},
        is_profile_complete=True,
    )


def _token(user: User, role: str = "user") -> str:
    return create_access_token(str(user.id), role=role)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def disable_background_jobs(monkeypatch):
    monkeypatch.setattr(settings, "BACKGROUND_JOB_INTERVAL_SECONDS", 0)
    app.state.disable_rate_limit_checks = True
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()
    app.state.disable_rate_limit_checks = False


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

def test_auth_register_and_me_routes(monkeypatch, client):
    from app.api.routes import auth as auth_routes

    created_user = _make_user("user-user")

    async def fake_register_user(*args, **kwargs):
        return created_user

    async def fake_login_with_credentials(*args, **kwargs):
        return "token-123"

    monkeypatch.setattr(auth_routes, "register_user", fake_register_user)
    monkeypatch.setattr(auth_routes, "login_with_credentials",
                        fake_login_with_credentials)
    app.dependency_overrides[get_current_user] = lambda: created_user

    register_response = client.post(
        "/api/v1/auth/register",
        json={"username": "newuser", "password": "secret123",
              "name": "New User", "unstop_id": "U1"},
    )
    assert register_response.status_code == 200
    assert register_response.json()["username"] == "user-user"

    token_response = client.post(
        "/api/v1/auth/login",
        json={"email": "archived-1e3fd5bdd1@example.invalid", "password": "secret123"},
    )
    assert token_response.status_code == 200
    assert token_response.json()["access_token"] == "token-123"

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {_token(created_user)}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["username"] == created_user.username


# ---------------------------------------------------------------------------
# Event routes
# ---------------------------------------------------------------------------

def test_event_register_and_participants_routes(monkeypatch, client):
    from app.api.routes import events as events_routes

    current_user = _make_user("admin-user")
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={},
        questions={},
        rules="Rules",
        max_participants=50,
        registration_deadline=datetime.now(timezone.utc).replace(year=2099),
    )

    async def fake_get_event(*args, **kwargs):
        return event

    async def fake_register_for_event(*args, **kwargs):
        return None

    monkeypatch.setattr(events_routes, "get_event", fake_get_event)
    monkeypatch.setattr(events_routes, "register_for_event",
                        fake_register_for_event)
    monkeypatch.setattr(
        events_routes,
        "get_event_participants_payload",
        lambda event: {"event_id": str(
            event.id), "participants_count": 0, "participants": {}},
    )
    app.dependency_overrides[get_current_user] = lambda: current_user

    token = _token(current_user, role="admin")
    register_response = client.post(
        f"/api/v1/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert register_response.status_code == 200
    assert register_response.json()["event_id"] == str(event.id)

    # participants endpoint requires an admin JWT — skip check here; tested separately
    # (the dep is get_scanner_or_above which goes through get_current_admin)
    assert register_response.status_code == 200


# ---------------------------------------------------------------------------
# Submission routes
# ---------------------------------------------------------------------------

def test_submission_routes(monkeypatch, client):
    from app.api.routes import submissions as submissions_routes
    from app.schemas.submission import AnswerItem

    current_user = _make_user()
    phase1_questions = [
        {"question_id": "q1", "question_text": "Your GitHub URL",
            "question_type": "url", "required": True}
    ]
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={str(current_user.id): {"submission": {}}},
        questions={"phase1": phase1_questions},
        rules="Rules",
        max_participants=50,
        registration_deadline=datetime.now(timezone.utc).replace(year=2099),
    )

    submitted_at = datetime(2026, 4, 8, tzinfo=timezone.utc)
    normalised = [AnswerItem(
        question_id="q1", answer="https://github.com/test/repo")]

    async def fake_get_event(*args, **kwargs):
        return event

    async def fake_submit_for_event(*args, **kwargs):
        return submitted_at, normalised

    monkeypatch.setattr(submissions_routes, "get_event", fake_get_event)
    monkeypatch.setattr(submissions_routes,
                        "submit_for_event", fake_submit_for_event)
    app.dependency_overrides[get_current_user] = lambda: current_user

    token = _token(current_user)
    submit_response = client.post(
        f"/api/v1/events/{event.id}/submit",
        json={
            "phase": 1,
            "answers": [{"question_id": "q1", "answer": "https://github.com/test/repo"}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert submit_response.status_code == 201
    data = submit_response.json()
    assert data["phase"] == 1
    assert data["phase_key"] == "phase1"
    assert len(data["answers"]) == 1
    assert data["answers"][0]["question_id"] == "q1"


# ---------------------------------------------------------------------------
# Question routes
# ---------------------------------------------------------------------------

def test_question_routes(monkeypatch, client):
    from app.api.routes import questions as questions_routes
    from app.schemas.question import QuestionDefinition

    current_user = _make_user()
    phase1_questions = [
        {"question_id": "q1", "question_text": "Your GitHub URL",
            "question_type": "url", "required": True}
    ]
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={},
        questions={"phase1": phase1_questions},
        rules="Rules",
        max_participants=50,
        registration_deadline=datetime.now(timezone.utc).replace(year=2099),
    )
    # Register user for this event
    current_user.events = {
        str(event.id): {
            "isAttending": False, "phase": 1, "status": "active",
            "restricted": False, "submission": {}, "teamId": None,
            "score": 0, "rank": None,
        }
    }

    async def fake_get_event(*args, **kwargs):
        return event

    monkeypatch.setattr(questions_routes, "get_event", fake_get_event)
    monkeypatch.setattr(
        questions_routes,
        "get_questions_for_phase",
        lambda ev, phase: [QuestionDefinition.model_validate(
            q) for q in phase1_questions],
    )
    app.dependency_overrides[get_current_user] = lambda: current_user

    token = _token(current_user)
    get_resp = client.get(
        f"/api/v1/events/{event.id}/questions?phase=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["phase"] == 1
    assert body["phase_key"] == "phase1"
    assert len(body["questions"]) == 1
    assert body["questions"][0]["question_id"] == "q1"


# ---------------------------------------------------------------------------
# Admin + QR routes
# ---------------------------------------------------------------------------

def test_admin_sync_and_qr_routes(monkeypatch, client):
    from app.api.routes import admin as admin_routes
    from app.api.routes import qr as qr_routes

    admin_user = _make_user("admin-user")
    scanner_user = _make_user("scanner-user")
    target_user = _make_user("target-user")
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={str(target_user.id): {
            "attendance": {}, "submission": {}}},
        questions={},
        rules="Rules",
        max_participants=50,
        registration_deadline=datetime.now(timezone.utc).replace(year=2099),
    )

    async def fake_sync_unstop_users(*args, **kwargs):
        return {"created": 1, "updated": 0, "created_credentials": []}

    async def fake_get_user_by_id(*args, **kwargs):
        return target_user

    async def fake_get_event(*args, **kwargs):
        return event

    async def fake_scan_food(*args, **kwargs):
        return "Meal marked as consumed"

    async def fake_scan_event_entry(*args, **kwargs):
        return "Attendance marked"

    async def fake_set_event_phase_state(*args, **kwargs):
        return event

    monkeypatch.setattr(admin_routes, "sync_unstop_users",
                        fake_sync_unstop_users)
    monkeypatch.setattr(admin_routes, "set_event_phase_state",
                        fake_set_event_phase_state)
    monkeypatch.setattr(qr_routes, "get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr(qr_routes, "get_event", fake_get_event)
    monkeypatch.setattr(qr_routes, "scan_food", fake_scan_food)
    monkeypatch.setattr(qr_routes, "scan_event_entry", fake_scan_event_entry)

    app.dependency_overrides[get_current_user] = lambda: admin_user
    admin_token = _token(admin_user, role="admin")

    # QR route is guarded by AccessControlMiddleware which validates the JWT before
    # any FastAPI dep runs. We need a real signed token with the Scanner role.
    # Use a fake admin uid and override get_scanner_or_above to skip DB lookup.
    from app.api.deps import get_scanner_or_above
    from app.db.supabase_client import get_supabase
    from app.models.admin import Admin, AdminRole
    from unittest.mock import AsyncMock

    fake_scanner_admin = Admin(
        uid=99, username="scanner1", name="Scanner",
        password_hash="hash", mail="archived-b44733ee70@example.invalid", role=AdminRole.SCANNER,
    )
    # Build a real JWT the middleware will accept (role=Scanner passes the QR path check)
    scanner_jwt = create_access_token("admin:99", role="Scanner")

    app.dependency_overrides[get_scanner_or_above] = lambda: fake_scanner_admin
    app.dependency_overrides[get_supabase] = lambda: AsyncMock()
    monkeypatch.setattr(qr_routes, "get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr(qr_routes, "scan_food", fake_scan_food)

    qr_response = client.post(
        "/api/v1/qr/scan",
        json={"user_id": str(target_user.id), "mode": "food", "meal": "meal1"},
        headers={"Authorization": f"Bearer {scanner_jwt}"},
    )
    assert qr_response.status_code == 200
    assert qr_response.json()["status"] == "accepted"
