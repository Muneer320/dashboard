from uuid import uuid4

from app.models.user import User


def test_user_from_row_parses_json_string_fields():
    row = {
        "id": str(uuid4()),
        "username": "visitor@example.com",
        "password_hash": "hash",
        "name": "Visitor",
        "details": '{"city":"Bangalore","emergency_contact":""}',
        "events": '{"event-1":{"phase":1}}',
        "food": '{"meal1":true}',
        "is_profile_complete": True,
        "is_attending": False,
        "cents": 0,
        "role": "visitor",
    }

    user = User.from_row(row)

    assert user.details == {"city": "Bangalore", "emergency_contact": ""}
    assert user.events == {"event-1": {"phase": 1}}
    assert user.food == {"meal1": True}
