from uuid import uuid4

from app.models.user import User
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

def test_user_events_payload() -> None:
    user = build_user()
    payload = get_user_events_payload(user)
    assert payload["user_id"]
    assert payload["events"] == user.events
