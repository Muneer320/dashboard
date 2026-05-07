from __future__ import annotations

from copy import deepcopy
from uuid import NAMESPACE_DNS, uuid4, uuid5

import pytest

from app.services.bulk_enroll_service import bulk_enroll


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, store: dict[str, list[dict]], table_name: str):
        self.store = store
        self.table_name = table_name
        self._action = "select"
        self._payload = None
        self._eq_filters: list[tuple[str, str]] = []
        self._in_filters: list[tuple[str, list[str]]] = []
        self._limit: int | None = None

    def select(self, _columns: str):
        self._action = "select"
        return self

    def eq(self, column: str, value):
        self._eq_filters.append((column, value))
        return self

    def in_(self, column: str, values):
        self._in_filters.append((column, list(values)))
        return self

    def limit(self, value: int):
        self._limit = value
        return self

    def update(self, payload: dict):
        self._action = "update"
        self._payload = deepcopy(payload)
        return self

    def insert(self, payload):
        self._action = "insert"
        self._payload = deepcopy(payload)
        return self

    def _matches(self, row: dict) -> bool:
        for column, value in self._eq_filters:
            if row.get(column) != value:
                return False
        for column, values in self._in_filters:
            if row.get(column) not in values:
                return False
        return True

    async def execute(self):
        table = self.store[self.table_name]
        matching = [row for row in table if self._matches(row)]

        if self._action == "select":
            result = deepcopy(matching)
            if self._limit is not None:
                result = result[: self._limit]
            return FakeResponse(result)

        if self._action == "insert":
            payload = self._payload
            items = payload if isinstance(payload, list) else [payload]
            table.extend(deepcopy(items))
            return FakeResponse(deepcopy(items))

        if self._action == "update":
            for row in matching:
                row.update(deepcopy(self._payload))
            return FakeResponse(deepcopy(matching))

        raise AssertionError(f"Unsupported action: {self._action}")


class FakeSupabase:
    def __init__(self, store: dict[str, list[dict]]):
        self.store = store

    def table(self, table_name: str) -> FakeQuery:
        return FakeQuery(self.store, table_name)


def _event_entry(team_id: str | None = None) -> dict:
    return {
        "isAttending": False,
        "phase": 0,
        "status": "registered",
        "restricted": False,
        "teamId": team_id,
        "score": None,
        "rank": None,
        "submission": None,
    }


def _user_row(user_id: str, email: str, name: str, events: dict[str, dict]) -> dict:
    return {
        "id": user_id,
        "username": email,
        "password_hash": "hash",
        "name": name,
        "unstop_id": None,
        "is_attending": False,
        "details": {"email": email},
        "events": deepcopy(events),
        "food": {},
        "is_profile_complete": False,
        "cents": 0,
    }


@pytest.mark.asyncio
async def test_bulk_enroll_adds_existing_user_to_new_event_and_creates_team():
    launchpad_id = "a1b2c3d4-0005-4000-8000-000000000005"
    anvil_id = "a1b2c3d4-0004-4000-8000-000000000004"
    user_id = str(uuid4())
    email = "archived-c19bf8fc49@example.invalid"
    team_uuid = str(uuid5(NAMESPACE_DNS, f"{launchpad_id}:U8IL57Y3"))

    store = {
        "events": [{"id": launchpad_id, "name": "Launchpad"}],
        "users": [
            _user_row(
                user_id,
                email,
                "Jaideep Siddartha Kalla",
                {anvil_id: _event_entry(team_id="old-anvil-team")},
            )
        ],
        "teams": [],
    }

    result = await bulk_enroll(
        FakeSupabase(store),
        launchpad_id,
        [
            {
                "email": email,
                "name": "Jaideep Siddartha Kalla",
                "team_id": "U8IL57Y3",
                "team_name": "Phoenix",
            }
        ],
    )

    assert result["summary"] == {
        "total_rows": 1,
        "created": 0,
        "added_to_existing": 1,
        "duplicates": 0,
        "errors": 0,
    }
    assert result["added_to_existing"] == [
        {
            "email": email,
            "user_id": user_id,
            "name": "Jaideep Siddartha Kalla",
        }
    ]

    updated_user = store["users"][0]
    assert launchpad_id in updated_user["events"]
    assert updated_user["events"][launchpad_id]["teamId"] == team_uuid
    assert updated_user["events"][anvil_id]["teamId"] == "old-anvil-team"

    assert store["teams"] == [
        {
            "id": team_uuid,
            "name": "Phoenix",
            "event_id": launchpad_id,
            "leader_id": None,
            "member_ids": [user_id],
        }
    ]


@pytest.mark.asyncio
async def test_bulk_enroll_keeps_same_event_registration_as_duplicate():
    launchpad_id = "a1b2c3d4-0005-4000-8000-000000000005"
    user_id = str(uuid4())
    email = "archived-c19bf8fc49@example.invalid"

    store = {
        "events": [{"id": launchpad_id, "name": "Launchpad"}],
        "users": [
            _user_row(
                user_id,
                email,
                "Jaideep Siddartha Kalla",
                {launchpad_id: _event_entry(team_id="existing-team")},
            )
        ],
        "teams": [],
    }

    result = await bulk_enroll(
        FakeSupabase(store),
        launchpad_id,
        [
            {
                "email": email,
                "name": "Jaideep Siddartha Kalla",
                "team_id": "U8IL57Y3",
                "team_name": "Phoenix",
            }
        ],
    )

    assert result["summary"] == {
        "total_rows": 1,
        "created": 0,
        "added_to_existing": 0,
        "duplicates": 1,
        "errors": 0,
    }
    assert result["duplicates_detail"] == [{"row": 2, "email": email}]
    assert store["users"][0]["events"][launchpad_id]["teamId"] == "existing-team"
    assert store["teams"] == []


@pytest.mark.asyncio
async def test_bulk_enroll_appends_existing_user_into_existing_team_members():
    launchpad_id = "a1b2c3d4-0005-4000-8000-000000000005"
    anvil_id = "a1b2c3d4-0004-4000-8000-000000000004"
    existing_member_id = str(uuid4())
    new_event_user_id = str(uuid4())
    email = "archived-5a2879a20c@example.invalid"
    team_uuid = str(uuid5(NAMESPACE_DNS, f"{launchpad_id}:U8IL57Y3"))

    store = {
        "events": [{"id": launchpad_id, "name": "Launchpad"}],
        "users": [
            _user_row(
                new_event_user_id,
                email,
                "Rishitha Varma",
                {anvil_id: _event_entry(team_id="anvil-team")},
            )
        ],
        "teams": [
            {
                "id": team_uuid,
                "name": "Phoenix",
                "event_id": launchpad_id,
                "leader_id": None,
                "member_ids": [existing_member_id],
            }
        ],
    }

    result = await bulk_enroll(
        FakeSupabase(store),
        launchpad_id,
        [
            {
                "email": email,
                "name": "Rishitha Varma",
                "team_id": "U8IL57Y3",
                "team_name": "Phoenix",
            }
        ],
    )

    assert result["summary"]["added_to_existing"] == 1
    assert store["teams"][0]["member_ids"] == [existing_member_id, new_event_user_id]
    assert store["users"][0]["events"][launchpad_id]["teamId"] == team_uuid
