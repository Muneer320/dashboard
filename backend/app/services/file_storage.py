from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import settings


def _upload_root() -> Path:
    upload_root = Path(settings.UPLOAD_ROOT)
    upload_root.mkdir(parents=True, exist_ok=True)
    return upload_root


@dataclass(frozen=True)
class SignedFileReference:
    file_path: Path
    filename: str
    token: str
    signed_url: str


def _sign_payload(payload: bytes) -> str:
    signature = hmac.new(
        settings.FILE_SIGNING_SECRET.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()
    token = base64.urlsafe_b64encode(
        payload + b"." + signature.encode("utf-8")).decode("utf-8")
    return token.rstrip("=")


def _decode_token(token: str) -> dict:
    padding = "=" * (-len(token) % 4)
    raw = base64.urlsafe_b64decode((token + padding).encode("utf-8"))
    payload, signature = raw.rsplit(b".", 1)
    expected_signature = hmac.new(
        settings.FILE_SIGNING_SECRET.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest().encode("utf-8")
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Invalid file signature")
    data = json.loads(payload.decode("utf-8"))
    expires_at = datetime.fromisoformat(data["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Signed URL expired")
    return data


async def save_submission_file(event_id: str, user_id: str, upload_file: UploadFile) -> SignedFileReference:
    safe_filename = Path(upload_file.filename or "submission.bin").name
    file_id = uuid4().hex
    storage_dir = _upload_root() / event_id / user_id
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / f"{file_id}_{safe_filename}"
    content = await upload_file.read()
    file_path.write_bytes(content)

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    payload = json.dumps(
        {
            "event_id": event_id,
            "user_id": user_id,
            "file_path": str(file_path),
            "filename": safe_filename,
            "expires_at": expires_at.isoformat(),
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    token = _sign_payload(payload)
    signed_url = f"/api/v1/files/{token}"

    return SignedFileReference(
        file_path=file_path,
        filename=safe_filename,
        token=token,
        signed_url=signed_url,
    )


def resolve_signed_file(token: str) -> dict:
    return _decode_token(token)


def file_response_from_token(token: str) -> FileResponse:
    data = resolve_signed_file(token)
    return FileResponse(path=data["file_path"], filename=data["filename"])
