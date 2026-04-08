from datetime import datetime, timedelta, timezone

import pytest

from app.models.rate_limit import RateLimitEntry
from app.services.rate_limit_service import allow_rate_limited_action, cleanup_expired_rate_limits


class FakeResult:
    def __init__(self, entry):
        self._entry = entry

    def scalar_one_or_none(self):
        return self._entry


class FakeSession:
    def __init__(self, entry=None):
        self.entry = entry
        self.added = []
        self.deleted = False
        self.committed = False

    async def execute(self, query):
        if query.__class__.__name__ == "Select":
            return FakeResult(self.entry)
        self.deleted = True
        return type("DeleteResult", (), {"rowcount": 1})()

    def add(self, obj):
        self.added.append(obj)
        self.entry = obj

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_allow_rate_limited_action_creates_updates_and_blocks():
    session = FakeSession()
    assert await allow_rate_limited_action(session, "key-1", limit=2, window_seconds=60) is True
    assert session.entry.request_count == 1

    assert await allow_rate_limited_action(session, "key-1", limit=2, window_seconds=60) is True
    assert session.entry.request_count == 2

    assert await allow_rate_limited_action(session, "key-1", limit=2, window_seconds=60) is False


@pytest.mark.asyncio
async def test_cleanup_expired_rate_limits():
    stale_entry = RateLimitEntry(
        rate_key="old-key",
        request_count=5,
        window_started_at=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    session = FakeSession(stale_entry)
    deleted = await cleanup_expired_rate_limits(session, window_seconds=60)
    assert deleted == 1
    assert session.deleted is True
