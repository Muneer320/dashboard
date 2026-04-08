from app.models.event import Event
from app.models.user import AccessLevel, User, UserRole
from app.services.event_service import get_event_participants_payload
from app.services.submission_service import get_submission_for_phase
from app.services.user_service import get_user_access_payload, get_user_events_payload


def build_user() -> User:
    return User(
        username="testuser",
        password_hash="hash",
        name="Test User",
        details={"email": "test@example.com"},
        events={
            "event-1": {
                "accessLevel": "ROUND1",
                "phase": 1,
            }
        },
        food={"meal1": False, "meal2": True, "meal3": False},
        access_level=AccessLevel.FINAL,
        role=UserRole.SCANNER,
        is_profile_complete=True,
    )


def build_event() -> Event:
    return Event(
        name="Hackathon",
        description="Test event",
        venue=["Hall A"],
        judges=["Judge One"],
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        participants={
            "user-1": {
                "registeredAt": "2026-04-08T00:00:00Z",
                "currentPhase": 1,
                "status": "active",
                "attendance": {"phase1": True},
                "submission": {"phase1": {"type": "url", "value": "https://example.com", "submittedAt": "2026-04-08T00:00:00Z"}},
            }
        },
        rules="Rules",
        max_participants=100,
    )


def test_user_events_payload() -> None:
    user = build_user()
    payload = get_user_events_payload(user)
    assert payload["user_id"]
    assert payload["events"] == user.events


def test_user_access_payload() -> None:
    user = build_user()
    payload = get_user_access_payload(user)
    assert payload["global_access_level"] == "FINAL"
    assert payload["role"] == "scanner"
    assert payload["event_access"] == {"event-1": "ROUND1"}


def test_event_participants_payload() -> None:
    event = build_event()
    payload = get_event_participants_payload(event)
    assert payload["participants_count"] == 1
    assert "user-1" in payload["participants"]


def test_submission_fetch_payload() -> None:
    user = build_user()
    event = build_event()
    payload = get_submission_for_phase(user, event, 1)
    assert payload["event_id"]
    assert payload["phase"] == 1
    assert payload["has_submission"] is False
    assert payload["submission"] is None
