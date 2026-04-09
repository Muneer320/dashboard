import pytest

from app.core.config import settings
from app.services.file_storage import save_submission_file


@pytest.mark.asyncio
async def test_save_submission_file_supabase_storage(monkeypatch):
    class FakeBucket:
        def __init__(self):
            self.upload_calls = []

        def upload(self, path, file, file_options):
            self.upload_calls.append((path, file, file_options))

        def create_signed_url(self, path, expires_in):
            return {"signedURL": f"https://example.supabase.co/storage/v1/object/sign/submissions/{path}?token=abc"}

    class FakeStorage:
        def __init__(self, bucket):
            self.bucket = bucket

        def from_(self, bucket_name):
            assert bucket_name == "submissions"
            return self.bucket

    class FakeClient:
        def __init__(self, bucket):
            self.storage = FakeStorage(bucket)

    fake_bucket = FakeBucket()

    monkeypatch.setattr(settings, "SUPABASE_URL",
                        "https://example.supabase.co")
    monkeypatch.setattr(
        settings, "SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "submissions")
    monkeypatch.setattr(settings, "SUPABASE_SIGNED_URL_EXPIRES_SECONDS", 600)
    monkeypatch.setattr(
        "app.services.file_storage._supabase_client", lambda: FakeClient(fake_bucket))

    class UploadStub:
        filename = "submission.txt"
        content_type = "text/plain"

        async def read(self):
            return b"hello world"

    reference = await save_submission_file("event-1", "user-1", UploadStub())

    assert reference.storage_path.startswith("event-1/user-1/")
    assert reference.filename == "submission.txt"
    assert reference.signed_url.startswith(
        "https://example.supabase.co/storage/v1/object/sign/")
    assert len(fake_bucket.upload_calls) == 1
