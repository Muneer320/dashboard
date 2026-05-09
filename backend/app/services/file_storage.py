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


@dataclass(frozen=True)
class StoredFileReference:
    storage_path: str
    filename: str


async def save_submission_file(event_id: str, user_id: str, upload_file: UploadFile) -> SignedFileReference:
    stored = await save_private_file(
        path_prefix=f"{event_id}/{user_id}",
        upload_file=upload_file,
    )
    signed_url = create_signed_file_url(stored.storage_path)
    return SignedFileReference(
        storage_path=stored.storage_path,
        filename=stored.filename,
        signed_url=signed_url,
    )


async def save_private_file(path_prefix: str, upload_file: UploadFile) -> StoredFileReference:
    safe_filename = Path(upload_file.filename or "submission.bin").name
    file_id = uuid4().hex
    normalized_prefix = path_prefix.strip("/").replace("\\", "/")
    storage_path = f"{normalized_prefix}/{file_id}_{safe_filename}"
    content = await upload_file.read()

    client = _supabase_client()
    bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)

    content_type = upload_file.content_type or "application/octet-stream"
    bucket.upload(
        path=storage_path,
        file=content,
        file_options={"content-type": content_type, "upsert": "false"},
    )
    return StoredFileReference(storage_path=storage_path, filename=safe_filename)


def create_signed_file_url(storage_path: str) -> str:
    client = _supabase_client()
    bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
    signed_response = bucket.create_signed_url(
        path=storage_path,
        expires_in=settings.SUPABASE_SIGNED_URL_EXPIRES_SECONDS,
    )
    signed_url = signed_response.get("signedURL") or signed_response.get("signedUrl")
    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create signed URL",
        )
    return signed_url


def delete_private_file(storage_path: str) -> None:
    client = _supabase_client()
    bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
    bucket.remove([storage_path])
