from pathlib import Path

import pytest

from app.core.config import settings
from app.services.file_storage import file_response_from_token, resolve_signed_file, save_submission_file


@pytest.mark.asyncio
async def test_save_and_resolve_signed_file(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(settings, "FILE_SIGNING_SECRET", "test-secret")
    monkeypatch.setattr(settings, "UPLOAD_ROOT", str(tmp_path))

    class UploadStub:
        filename = "submission.txt"

        async def read(self):
            return b"hello world"

    reference = await save_submission_file("event-1", "user-1", UploadStub())
    data = resolve_signed_file(reference.token)

    assert Path(data["file_path"]).exists()
    assert data["filename"] == "submission.txt"
    assert reference.signed_url.startswith("/api/v1/files/")
