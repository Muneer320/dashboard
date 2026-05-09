from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

import boto3
from botocore.config import Config as BotoConfig
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings


@dataclass(frozen=True)
class MirageStoredObject:
    object_key: str
    filename: str
    public_url: str


def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.MIRAGE_S3_REGION,
        endpoint_url=settings.MIRAGE_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        aws_session_token=settings.AWS_SESSION_TOKEN,
        config=BotoConfig(signature_version="s3v4"),
    )


def _public_url_for_key(object_key: str) -> str:
    base = settings.MIRAGE_S3_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/{quote(object_key)}"


def _signed_url_for_key(object_key: str) -> str:
    client = _s3_client()
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": settings.MIRAGE_S3_BUCKET_NAME,
            "Key": object_key,
        },
        ExpiresIn=settings.MIRAGE_S3_SIGNED_URL_EXPIRES_SECONDS,
    )


async def save_mirage_image(path_prefix: str, upload_file: UploadFile) -> MirageStoredObject:
    if not settings.MIRAGE_S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Mirage S3 bucket is not configured.",
        )

    safe_filename = Path(upload_file.filename or "image.bin").name
    normalized_prefix = path_prefix.strip("/").replace("\\", "/")
    object_key = f"{normalized_prefix}/{uuid4().hex}_{safe_filename}"
    content = await upload_file.read()
    content_type = upload_file.content_type or "application/octet-stream"
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded Mirage image is empty.",
        )

    def _upload() -> None:
        client = _s3_client()
        client.put_object(
            Bucket=settings.MIRAGE_S3_BUCKET_NAME,
            Key=object_key,
            Body=content,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
            ContentDisposition=f'inline; filename="{safe_filename}"',
        )

    try:
        await asyncio.to_thread(_upload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload the Mirage image to S3.",
        ) from exc

    return MirageStoredObject(
        object_key=object_key,
        filename=safe_filename,
        public_url=_public_url_for_key(object_key),
    )


def delete_mirage_image(object_key: str) -> None:
    if not object_key:
        return
    client = _s3_client()
    client.delete_object(Bucket=settings.MIRAGE_S3_BUCKET_NAME, Key=object_key)


def mirage_public_url(object_key: str | None) -> str | None:
    if not object_key:
        return None
    try:
        return _signed_url_for_key(object_key)
    except Exception:
        return _public_url_for_key(object_key)
