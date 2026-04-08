from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models.event import Event
from app.services import background_jobs


class FakeResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class FakeSession:
    def __init__(self, events):
        self.events = events
        self.committed = False
        self.added = []

    async def execute(self, query):
        return FakeResult(self.events)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


class FakeSessionContext:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_enforce_event_phase_state(monkeypatch):
    event = Event(
        name="Hackathon",
        description="Event",
        venue=["Hall A"],
        judges=["Judge"],
        rounds={
            "phase1": {
                "is_active": True,
                "is_locked": False,
                "end_time": "2024-01-01T00:00:00+00:00",
            }
        },
        participants={},
        rules="Rules",
        max_participants=50,
        registration_deadline=datetime.now(timezone.utc),
    )
    session = FakeSession([event])
    monkeypatch.setattr(background_jobs, "AsyncSessionLocal", lambda: FakeSessionContext(session))

    await background_jobs.enforce_event_phase_state()

    assert session.committed is True
    assert event.rounds["phase1"]["is_active"] is False
    assert event.rounds["phase1"]["is_locked"] is True


@pytest.mark.asyncio
async def test_sync_unstop_from_file_source(monkeypatch, tmp_path: Path):
    source_file = tmp_path / "unstop.json"
    source_file.write_text(
        '[{"unstop_id":"U-1","username":"user1","name":"User 1","details":{},"access_level":"ROUND1","is_profile_complete":true}]',
        encoding="utf-8",
    )
    monkeypatch.setattr(background_jobs.settings, "UNSTOP_SYNC_SOURCE_JSON", str(source_file))

    captured = {}

    async def fake_sync_unstop_users(session, users):
        captured["count"] = len(users)
        captured["first_username"] = users[0].username
        return {"created": 1, "updated": 0, "created_credentials": []}

    monkeypatch.setattr(background_jobs, "sync_unstop_users", fake_sync_unstop_users)
    monkeypatch.setattr(background_jobs, "AsyncSessionLocal", lambda: FakeSessionContext(FakeSession([])))

    await background_jobs.sync_unstop_from_file_source()

    assert captured["count"] == 1
    assert captured["first_username"] == "user1"
