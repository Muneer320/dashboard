import pytest

from app.models.user import AccessLevel, User, UserRole
from app.schemas.unstop import UnstopUserItem
from app.services.unstop_service import sync_unstop_users


class FakeResult:
    def __init__(self, user):
        self._user = user

    def scalar_one_or_none(self):
        return self._user


class FakeSession:
    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.committed = False

    async def execute(self, query):
        if not self.results:
            raise AssertionError("Unexpected query execution")
        return FakeResult(self.results.pop(0))

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_sync_unstop_users_creates_and_updates_users(monkeypatch) -> None:
    existing = User(
        username="existing",
        password_hash="hash",
        name="Existing User",
        unstop_id="U-001",
        details={},
        events={},
        food={"meal1": False, "meal2": False, "meal3": False},
        access_level=AccessLevel.ROUND1,
        role=UserRole.USER,
        is_profile_complete=False,
    )

    session = FakeSession([None, existing])
    payload = [
        UnstopUserItem(
            unstop_id="U-002",
            username="newuser",
            name="New User",
            details={"email": "new@example.com"},
            access_level="FULL",
            is_profile_complete=True,
        ),
        UnstopUserItem(
            unstop_id="U-001",
            username="existing",
            name="Existing Updated",
            details={"email": "existing@example.com"},
            access_level="FINAL",
            is_profile_complete=True,
        ),
    ]

    monkeypatch.setattr("app.services.unstop_service.get_password_hash", lambda _: "hashed-password")

    result = await sync_unstop_users(session, payload)  # type: ignore[arg-type]

    assert result["created"] == 1
    assert result["updated"] == 1
    assert len(result["created_credentials"]) == 1
    assert session.committed is True
    assert len(session.added) == 1
    assert session.added[0].username == "newuser"
    assert existing.name == "Existing Updated"
    assert existing.access_level.value == "FINAL"
