"""
S3 storage — uploads UGC proof images to AWS S3 and returns their
public URL. Credentials and bucket config come from environment
variables; the boto3 client is cached after the first call so we
don't re-handshake per request.

Bucket layout: <bucket>/<student_id>/<uuid>.<ext>
"""

from __future__ import annotations

import asyncio
import logging
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _client():
    import boto3
    return boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _bucket() -> str:
    name = settings.AWS_S3_UGC_BUCKET
    if not name:
        raise RuntimeError("AWS_S3_UGC_BUCKET env var is not set")
    return name


def _public_url(key: str) -> str:
    return f"https://{_bucket()}.s3.{settings.AWS_S3_REGION}.amazonaws.com/{key}"


def _put_sync(key: str, body: bytes, content_type: str) -> None:
    _client().put_object(
        Bucket=_bucket(),
        Key=key,
        Body=body,
        ContentType=content_type,
    )


async def upload_ugc_proof(
    *,
    key: str,
    body: bytes,
    content_type: str,
) -> str:
    """Upload bytes to S3 under `key` and return its public URL.

    Caller is responsible for picking the key (typically
    `{student_id}/{uuid}.{ext}`). Raises RuntimeError on failure so the
    route can convert it to a 500 with a sensible message.
    """
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _put_sync, key, body, content_type)
    except Exception as exc:
        logger.warning("S3 upload failed for %s: %s", key, exc)
        raise RuntimeError(f"S3 upload failed: {exc}") from exc

    url = _public_url(key)
    logger.info("S3 object written: %s", url)
    return url
