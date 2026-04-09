from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from supabase import Client, create_client

from app.core.config import settings


def _supabase_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase Storage is not configured",
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@dataclass(frozen=True)
class SignedFileReference:
    storage_path: str
    filename: str
    signed_url: str


async def save_submission_file(event_id: str, user_id: str, upload_file: UploadFile) -> SignedFileReference:
    safe_filename = Path(upload_file.filename or "submission.bin").name
    file_id = uuid4().hex
    storage_path = f"{event_id}/{user_id}/{file_id}_{safe_filename}"
    content = await upload_file.read()

    client = _supabase_client()
    bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)

    content_type = upload_file.content_type or "application/octet-stream"
    bucket.upload(
        path=storage_path,
        file=content,
        file_options={"content-type": content_type, "upsert": "false"},
    )

    signed_response = bucket.create_signed_url(
        path=storage_path,
        expires_in=settings.SUPABASE_SIGNED_URL_EXPIRES_SECONDS,
    )

    signed_url = signed_response.get(
        "signedURL") or signed_response.get("signedUrl")
    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create signed URL",
        )

    return SignedFileReference(
        storage_path=storage_path,
        filename=safe_filename,
        signed_url=signed_url,
    )
