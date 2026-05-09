from __future__ import annotations

import io
import json
import mimetypes
import re
import tempfile
import time
from html import unescape
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin, urlparse

from app.core.config import settings

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive.readonly",)

_FOLDER_ID_RE = re.compile(
    r"(?:https?://)?(?:www\.)?drive\.google\.com/(?:drive/)?(?:u/\d+/)?folders/([a-zA-Z0-9_-]+)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class DriveImageFile:
    file_id: str
    name: str
    mime_type: str


@dataclass(frozen=True)
class DriveFilePayload:
    file_id: str
    name: str
    mime_type: str
    content: bytes


_IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".nef",
}
_PUBLIC_ENTRY_RE = re.compile(
    r'<a href="(?P<href>[^"]+)" target="_blank">.*?<div class="flip-entry-title">(?P<title>.*?)</div></a>',
    re.S,
)
_FILE_ID_RE = re.compile(
    r"(?:/file/d/|[?&]id=)([a-zA-Z0-9_-]+)",
    re.IGNORECASE,
)
_CONFIRM_FORM_RE = re.compile(
    r'<form[^>]+id="download-form"[^>]+action="(?P<action>[^"]+)"(?P<body>.*?)</form>',
    re.S,
)
_HIDDEN_INPUT_RE = re.compile(
    r'<input[^>]+type="hidden"[^>]+name="(?P<name>[^"]+)"[^>]+value="(?P<value>[^"]*)"',
    re.S,
)
_CONFIRM_LINK_RE = re.compile(r'href="(?P<href>[^"]*confirm[^"]*)"', re.I)
_FOLDER_CACHE_TTL_SECONDS = 10 * 60
_FILE_CACHE_TTL_SECONDS = 24 * 60 * 60
_CACHE_DIR = Path(tempfile.gettempdir()) / "ascent-mirage-cache"
_FOLDER_CACHE: dict[tuple[str, bool, int | None], tuple[float, list["DriveImageFile"]]] = {}


def parse_drive_folder_id(folder_url_or_id: str) -> str:
    raw = folder_url_or_id.strip()
    if not raw:
        raise ValueError("Drive folder URL or ID is empty.")
    if re.fullmatch(r"[a-zA-Z0-9_-]+", raw):
        return raw
    match = _FOLDER_ID_RE.search(raw)
    if match:
        return match.group(1)
    raise ValueError(
        "Could not parse a Google Drive folder ID. "
        "Use a folder link or paste the folder ID directly.",
    )


def drive_file_view_url(file_id: str) -> str:
    return f"https://drive.google.com/file/d/{file_id}/view"


def public_drive_file_url(file_id: str) -> str:
    return (
        "https://drive.usercontent.google.com/download"
        f"?id={quote(file_id)}&export=download&authuser=0&confirm=t"
    )


def parse_drive_file_id(file_url_or_id: str) -> str:
    raw = file_url_or_id.strip()
    if not raw:
        raise ValueError("Drive file URL or ID is empty.")
    if re.fullmatch(r"[a-zA-Z0-9_-]+", raw):
        return raw
    match = _FILE_ID_RE.search(raw)
    if match:
        return match.group(1)
    raise ValueError(
        "Could not parse a Google Drive file ID. Use a file link, direct download URL, or raw file ID.",
    )


def has_google_credentials() -> bool:
    return bool(settings.GOOGLE_SERVICE_ACCOUNT_JSON or settings.GOOGLE_APPLICATION_CREDENTIALS)


def _load_google_modules() -> tuple[Any, Any, Any, Any]:
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
        from googleapiclient.http import MediaIoBaseDownload
    except ImportError as exc:  # pragma: no cover - env-specific
        raise RuntimeError(
            "Google Drive dependencies are not installed on the backend. "
            "Add google-api-python-client and google-auth packages before using Mirage.",
        ) from exc
    return service_account, build, HttpError, MediaIoBaseDownload


def _build_credentials() -> Any:
    service_account, _, _, _ = _load_google_modules()
    if settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        try:
            info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
        except json.JSONDecodeError as exc:
            raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.") from exc
        return service_account.Credentials.from_service_account_info(
            info,
            scopes=DRIVE_SCOPES,
        )
    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        return service_account.Credentials.from_service_account_file(
            settings.GOOGLE_APPLICATION_CREDENTIALS,
            scopes=DRIVE_SCOPES,
        )
    raise RuntimeError(
        "Google Drive credentials are not configured. "
        "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON.",
    )


def _drive_service() -> Any:
    _, build, _, _ = _load_google_modules()
    creds = _build_credentials()
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _is_image_name(name: str) -> bool:
    return (mimetypes.guess_type(name)[0] or "").startswith("image/") or any(
        name.lower().endswith(ext) for ext in _IMAGE_EXTENSIONS
    )


def _public_folder_url(folder_id: str) -> str:
    return f"https://drive.google.com/embeddedfolderview?id={folder_id}#grid"


def _parse_public_entries(html: str) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    for match in _PUBLIC_ENTRY_RE.finditer(html):
        href = unescape(match.group("href"))
        title = unescape(re.sub(r"<.*?>", "", match.group("title"))).strip()
        entries.append((href, title))
    return entries


def _looks_like_html(headers: dict[str, str], content: bytes) -> bool:
    content_type = (headers.get("Content-Type") or headers.get("content-type") or "").lower()
    if "text/html" in content_type:
        return True
    sample = content[:256].lstrip().lower()
    return sample.startswith(b"<!doctype html") or sample.startswith(b"<html")


def _extract_confirm_url(html: str, current_url: str) -> str | None:
    form_match = _CONFIRM_FORM_RE.search(html)
    if form_match:
        action = unescape(form_match.group("action"))
        body = form_match.group("body") or ""
        params = {
            unescape(match.group("name")): unescape(match.group("value"))
            for match in _HIDDEN_INPUT_RE.finditer(body)
        }
        if params:
            query = "&".join(f"{quote(key)}={quote(value)}" for key, value in params.items())
            separator = "&" if "?" in action else "?"
            return urljoin(current_url, f"{action}{separator}{query}")
        return urljoin(current_url, action)

    link_match = _CONFIRM_LINK_RE.search(html)
    if link_match:
        return urljoin(current_url, unescape(link_match.group("href")))
    return None


def _list_public_folder_images(
    folder_id: str,
    *,
    recursive: bool = False,
    limit: int | None = None,
) -> list[DriveImageFile]:
    import requests

    collected: list[DriveImageFile] = []
    seen_folders: set[str] = set()

    def walk(current_folder_id: str) -> None:
        nonlocal collected
        if current_folder_id in seen_folders:
            return
        seen_folders.add(current_folder_id)
        if limit is not None and len(collected) >= limit:
            return

        response = requests.get(_public_folder_url(current_folder_id), timeout=20)
        response.raise_for_status()

        for href, title in _parse_public_entries(response.text):
            folder_match = _FOLDER_ID_RE.search(href)
            if folder_match:
                if recursive:
                    walk(folder_match.group(1))
                continue

            file_match = re.search(r"/file/d/([a-zA-Z0-9_-]+)", href)
            if file_match and _is_image_name(title):
                mime_type = mimetypes.guess_type(title)[0] or "image/jpeg"
                collected.append(
                    DriveImageFile(
                        file_id=file_match.group(1),
                        name=title or file_match.group(1),
                        mime_type=mime_type,
                    )
                )
                if limit is not None and len(collected) >= limit:
                    return

    walk(folder_id)
    return sorted(collected, key=lambda item: item.name.lower())


def _get_folder_cache(
    folder_id: str,
    recursive: bool,
    limit: int | None,
) -> list[DriveImageFile] | None:
    key = (folder_id, recursive, limit)
    cached = _FOLDER_CACHE.get(key)
    if not cached:
        return None
    expires_at, files = cached
    if expires_at <= time.time():
        _FOLDER_CACHE.pop(key, None)
        return None
    return files


def _set_folder_cache(
    folder_id: str,
    recursive: bool,
    limit: int | None,
    files: list[DriveImageFile],
) -> list[DriveImageFile]:
    _FOLDER_CACHE[(folder_id, recursive, limit)] = (
        time.time() + _FOLDER_CACHE_TTL_SECONDS,
        files,
    )
    return files


def _cache_paths(file_id: str) -> tuple[Path, Path]:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR / f"{file_id}.bin", _CACHE_DIR / f"{file_id}.json"


def _read_cached_file(file_id: str) -> DriveFilePayload | None:
    data_path, meta_path = _cache_paths(file_id)
    if not data_path.exists() or not meta_path.exists():
        return None
    try:
        metadata = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if float(metadata.get("expires_at", 0)) <= time.time():
        return None
    try:
        content = data_path.read_bytes()
    except OSError:
        return None
    return DriveFilePayload(
        file_id=file_id,
        name=metadata.get("name") or file_id,
        mime_type=metadata.get("mime_type") or "application/octet-stream",
        content=content,
    )


def _write_cached_file(payload: DriveFilePayload) -> DriveFilePayload:
    data_path, meta_path = _cache_paths(payload.file_id)
    try:
        data_path.write_bytes(payload.content)
        meta_path.write_text(
            json.dumps(
                {
                    "name": payload.name,
                    "mime_type": payload.mime_type,
                    "expires_at": time.time() + _FILE_CACHE_TTL_SECONDS,
                }
            ),
            encoding="utf-8",
        )
    except OSError:
        return payload
    return payload


def list_folder_images(
    folder_id: str,
    *,
    recursive: bool = False,
    limit: int | None = None,
) -> list[DriveImageFile]:
    cached = _get_folder_cache(folder_id, recursive, limit)
    if cached is not None:
        return cached
    try:
        files = _list_public_folder_images(folder_id, recursive=recursive, limit=limit)
        if files:
            return _set_folder_cache(folder_id, recursive, limit, files)
    except Exception:
        if not has_google_credentials():
            raise RuntimeError(
                "Public Drive folder read failed. Make sure the folder and nested image folders "
                "are shared publicly and directly downloadable."
            ) from None

    service = _drive_service()
    _, _, HttpError, _ = _load_google_modules()
    collected: list[DriveImageFile] = []

    def walk(current_folder: str) -> None:
        nonlocal collected
        if limit is not None and len(collected) >= limit:
            return
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
            except HttpError as exc:
                raise RuntimeError(
                    "Drive API list failed. Share the folder with the service account "
                    "email and ensure the Drive API is enabled.",
                ) from exc

            for item in response.get("files", []):
                mime_type = item.get("mimeType") or ""
                if mime_type == "application/vnd.google-apps.folder":
                    if recursive:
                        walk(item["id"])
                    continue
                if mime_type.startswith("image/"):
                    collected.append(
                        DriveImageFile(
                            file_id=item["id"],
                            name=item.get("name") or item["id"],
                            mime_type=mime_type,
                        )
                    )
                    if limit is not None and len(collected) >= limit:
                        return

            page_token = response.get("nextPageToken")
            if not page_token:
                break

    walk(folder_id)
    return _set_folder_cache(
        folder_id,
        recursive,
        limit,
        sorted(collected, key=lambda item: item.name.lower()),
    )


def download_file(file_id: str) -> DriveFilePayload:
    cached = _read_cached_file(file_id)
    if cached is not None:
        return cached

    import requests

    try:
        response = requests.get(public_drive_file_url(file_id), timeout=30, allow_redirects=True)
        response.raise_for_status()
        if _looks_like_html(dict(response.headers), response.content):
            confirm_url = _extract_confirm_url(response.text, response.url)
            if confirm_url:
                response = requests.get(confirm_url, timeout=30, allow_redirects=True)
                response.raise_for_status()
        name_match = re.search(r'filename="([^"]+)"', response.headers.get("Content-Disposition", ""))
        name = name_match.group(1) if name_match else file_id
        if name == file_id:
            name = Path(urlparse(response.url).path).name or file_id
        mime_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        return _write_cached_file(DriveFilePayload(
            file_id=file_id,
            name=name,
            mime_type=mime_type,
            content=response.content,
        ))
    except Exception:
        if not has_google_credentials():
            raise RuntimeError(f"Public Drive file fetch failed for '{file_id}'.") from None

    service = _drive_service()
    _, _, HttpError, MediaIoBaseDownload = _load_google_modules()
    try:
        meta = (
            service.files()
            .get(
                fileId=file_id,
                fields="id, name, mimeType",
                supportsAllDrives=True,
            )
            .execute()
        )
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    except HttpError as exc:
        raise RuntimeError(f"Drive API could not open file '{file_id}'.") from exc

    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buffer.seek(0)

    return _write_cached_file(DriveFilePayload(
        file_id=file_id,
        name=meta.get("name") or file_id,
        mime_type=meta.get("mimeType") or "application/octet-stream",
        content=buffer.read(),
    ))
