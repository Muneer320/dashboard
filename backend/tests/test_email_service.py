import pytest

from app.services.email_service import send_temporary_credentials


@pytest.mark.asyncio
async def test_send_temporary_credentials_returns_false_when_unconfigured():
    assert await send_temporary_credentials(None, "user", "secret") is False
