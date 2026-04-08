from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models.event import Event
from app.models.user import AccessLevel, User, UserRole


@pytest.fixture(autouse=True)
def disable_background_jobs(monkeypatch):
    monkeypatch.setattr(settings, "BACKGROUND_JOB_INTERVAL_SECONDS", 0)
    app.state.disable_rate_limit_checks = True
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()
    app.state.disable_rate_limit_checks = False


@pytest.fixture
async def fake_session():
    yield object()


@pytest.fixture
def user_factory():
    def factory(role: UserRole = UserRole.USER) -> User:
        return User(
            id=uuid4(),
            username=f"user-{role.value}",
            password_hash="hash",
            name="Test User",
            details={},
            events={},
            food={"meal1": False, "meal2": False, "meal3": False},
            access_level=AccessLevel.FULL if role != UserRole.USER else AccessLevel.ROUND1,
            role=role,
            is_profile_complete=True,
        )

    return factory


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_auth_register_and_me_routes(monkeypatch, client, user_factory):
    from app.api.routes import auth as auth_routes

    created_user = user_factory()

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
        json={"username": "newuser", "password": "secret123"},
    )
    assert token_response.status_code == 200
    assert token_response.json()["access_token"] == "token-123"

    me_response = client.get("/api/v1/auth/me", headers={
                             "Authorization": f"Bearer {create_access_token(str(created_user.id), role=created_user.role.value)}"})
    assert me_response.status_code == 200
    assert me_response.json()["username"] == created_user.username


def test_event_register_and_participants_routes(monkeypatch, client, user_factory):
    from app.api.routes import events as events_routes

    current_user = user_factory(UserRole.ADMIN)
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={},
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
    monkeypatch.setattr(events_routes, "get_event_participants_payload", lambda event: {
                        "event_id": str(event.id), "participants_count": 0, "participants": {}})
    app.dependency_overrides[get_current_user] = lambda: current_user

    token = create_access_token(
        str(current_user.id), role=current_user.role.value)
    register_response = client.post(
        f"/api/v1/events/{event.id}/register", headers={"Authorization": f"Bearer {token}"})
    assert register_response.status_code == 200
    assert register_response.json()["event_id"] == str(event.id)

    participants_response = client.get(
        f"/api/v1/events/{event.id}/participants", headers={"Authorization": f"Bearer {token}"})
    assert participants_response.status_code == 200
    assert participants_response.json()["participants_count"] == 0


def test_submission_url_and_file_routes(monkeypatch, client, user_factory):
    from app.api.routes import submissions as submissions_routes

    current_user = user_factory()
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={str(current_user.id): {"submission": {}}},
        rules="Rules",
        max_participants=50,
        registration_deadline=datetime.now(timezone.utc).replace(year=2099),
    )

    async def fake_get_event(*args, **kwargs):
        return event

    async def fake_submit_for_event(*args, **kwargs):
        return datetime(2026, 4, 8, tzinfo=timezone.utc)

    async def fake_save_submission_file(*args, **kwargs):
        return SimpleNamespace(signed_url="/api/v1/files/token123")

    monkeypatch.setattr(submissions_routes, "get_event", fake_get_event)
    monkeypatch.setattr(submissions_routes,
                        "submit_for_event", fake_submit_for_event)
    monkeypatch.setattr(submissions_routes,
                        "save_submission_file", fake_save_submission_file)
    app.dependency_overrides[get_current_user] = lambda: current_user

    token = create_access_token(
        str(current_user.id), role=current_user.role.value)
    url_response = client.post(
        f"/api/v1/events/{event.id}/submit",
        json={"phase": 1, "submission_type": "url",
              "value": "https://example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert url_response.status_code == 200
    assert url_response.json()["phase"] == 1

    file_response = client.post(
        f"/api/v1/events/{event.id}/submit",
        data={"phase": "1", "submission_type": "file", "value": ""},
        files={"file": ("submission.txt", b"hello world", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert file_response.status_code == 200
    assert file_response.json()["phase"] == 1


def test_admin_sync_and_qr_routes(monkeypatch, client, user_factory):
    from app.api.routes import admin as admin_routes
    from app.api.routes import qr as qr_routes

    admin_user = user_factory(UserRole.ADMIN)
    scanner_user = user_factory(UserRole.SCANNER)
    target_user = user_factory()
    event = Event(
        id=uuid4(),
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={str(target_user.id): {
            "attendance": {}, "submission": {}}},
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
    admin_token = create_access_token(
        str(admin_user.id), role=admin_user.role.value)
    sync_response = client.post(
        "/api/v1/admin/unstop/sync",
        json={"users": [{"unstop_id": "U-1", "username": "user1", "name": "User 1",
                         "details": {}, "access_level": "ROUND1", "is_profile_complete": True}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert sync_response.status_code == 200
    assert sync_response.json()["created"] == 1

    phase_response = client.post(
        f"/api/v1/admin/events/{event.id}/phases/1/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert phase_response.status_code == 200
    assert phase_response.json()["message"] == "Phase activated"

    app.dependency_overrides[get_current_user] = lambda: scanner_user
    scanner_token = create_access_token(
        str(scanner_user.id), role=scanner_user.role.value)
    qr_response = client.post(
        "/api/v1/qr/scan",
        json={"user_id": str(target_user.id), "mode": "food", "meal": "meal1"},
        headers={"Authorization": f"Bearer {scanner_token}"},
    )
    assert qr_response.status_code == 200
    assert qr_response.json()["status"] == "accepted"
