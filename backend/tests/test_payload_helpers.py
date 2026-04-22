from uuid import uuid4

from app.models.event import Event
from app.models.user import User
from app.services.event_service import get_event_participants_payload
from app.services.user_service import get_user_events_payload


def build_user() -> User:
    return User(
        id=uuid4(),
        username="testuser",
        password_hash="hash",
        name="Test User",
        details={"email": "test@example.com"},
        events={},
        food={"meal1": False, "meal2": True, "meal3": False},
        is_profile_complete=True,
    )


def build_event() -> Event:
    return Event(
        id=uuid4(),
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
                "submission": {
                    "phase1": {
                        "submitted": True,
                        "submitted_at": "2026-04-08T00:00:00Z",
                        "answers": [],
                    }
                },
            }
        },
        questions={"phase1": []},
        rules="Rules",
        max_participants=100,
    )


def test_user_events_payload() -> None:
    user = build_user()
    payload = get_user_events_payload(user)
    assert payload["user_id"]
    assert payload["events"] == user.events


def test_event_participants_payload() -> None:
    event = build_event()
    payload = get_event_participants_payload(event)
    assert payload["participants_count"] == 1
    assert "user-1" in payload["participants"]
