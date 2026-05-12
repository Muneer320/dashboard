from __future__ import annotations

import io
import re
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive.readonly",)

_FOLDER_ID_RE = re.compile(
    r"(?:https?://)?(?:www\.)?drive\.google\.com/(?:drive/)?(?:u/\d+/)?folders/([a-zA-Z0-9_-]+)",
    re.IGNORECASE,
)


def parse_drive_folder_id(folder_url_or_id: str) -> str:
    raw = folder_url_or_id.strip()
    if not raw:
        raise ValueError("Drive folder URL or id is empty")
    if re.fullmatch(r"[a-zA-Z0-9_-]+", raw):
        return raw
    match = _FOLDER_ID_RE.search(raw)
    if match:
        return match.group(1)
    raise ValueError(
        "Could not parse a Google Drive folder id. "
        "Use a link like https://drive.google.com/drive/folders/<FOLDER_ID> "
        "or paste the folder id alone.",
    )


def drive_file_view_url(file_id: str) -> str:
    return f"https://drive.google.com/file/d/{file_id}/view"


@dataclass(frozen=True)
class DriveImageFile:
    file_id: str
    name: str
    mime_type: str


def _drive_service(credentials_json_path: Path) -> Any:
    creds = service_account.Credentials.from_service_account_file(
        str(credentials_json_path),
        scopes=DRIVE_SCOPES,
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def iter_image_files_in_folder(
    credentials_json_path: Path,
    folder_id: str,
    *,
    recursive: bool = False,
) -> Iterator[DriveImageFile]:
    service = _drive_service(credentials_json_path)

    def walk(current_folder: str) -> Iterator[DriveImageFile]:
        page_token: str | None = None
        while True:
            try:
                response = (
                    service.files()
                    .list(
                        q=f"'{current_folder}' in parents and trashed = false",
                        spaces="drive",
                        fields="nextPageToken, files(id, name, mimeType)",
                        pageToken=page_token,
                        pageSize=200,
                        supportsAllDrives=True,
                        includeItemsFromAllDrives=True,
                    )
                    .execute()
                )
            except HttpError as error:
                raise RuntimeError(
                    "Drive API list failed. Share the folder with the service account email "
                    "from your JSON (Viewer is enough), and ensure the Drive API is enabled."
                ) from error

            for item in response.get("files", []):
                mid = item.get("mimeType") or ""
                if mid == "application/vnd.google-apps.folder":
                    if recursive:
                        yield from walk(item["id"])
                    continue
                if mid.startswith("image/"):
                    yield DriveImageFile(
                        file_id=item["id"],
                        name=item.get("name") or item["id"],
                        mime_type=mid,
                    )

            page_token = response.get("nextPageToken")
            if not page_token:
                break

    yield from walk(folder_id)


def download_drive_file_to_temp(
    credentials_json_path: Path,
    file_id: str,
    *,
    suffix: str,
) -> Path:
    service = _drive_service(credentials_json_path)
    buffer = io.BytesIO()
    try:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    except HttpError as error:
        raise RuntimeError(f"Drive API could not open file {file_id}") from error

    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    buffer.seek(0)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(buffer.read())
        tmp.flush()
        path = Path(tmp.name)
    finally:
        tmp.close()
    return path
