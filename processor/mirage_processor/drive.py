from __future__ import annotations

import io
import mimetypes
import re
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive.readonly",)

_FOLDER_ID_RE = re.compile(
    r"(?:https?://)?(?:www\.)?drive\.google\.com/(?:drive/)?(?:u/\d+/)?folders/([a-zA-Z0-9_-]+)",
    re.IGNORECASE,
)
_PUBLIC_ENTRY_RE = re.compile(
    r'<a href="(?P<href>[^"]+)" target="_blank">.*?<div class="flip-entry-title">(?P<title>.*?)</div></a>',
    re.S,
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
_IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic",
}
_HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AscentMirageProcessor/1.0",
}


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


def public_drive_file_url(file_id: str) -> str:
    return (
        "https://drive.usercontent.google.com/download"
        f"?id={quote(file_id)}&export=download&authuser=0&confirm=t"
    )


def _public_folder_url(folder_id: str) -> str:
    return f"https://drive.google.com/embeddedfolderview?id={folder_id}#grid"


def _is_image_name(name: str) -> bool:
    guessed = mimetypes.guess_type(name)[0] or ""
    return guessed.startswith("image/") or any(name.lower().endswith(ext) for ext in _IMAGE_EXTENSIONS)


def _open_url(url: str):
    request = Request(url, headers=_HTTP_HEADERS)
    return urlopen(request, timeout=30)


def _read_url(url: str) -> tuple[bytes, dict[str, str], str]:
    with _open_url(url) as response:
        return response.read(), dict(response.headers), response.geturl()


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


@dataclass(frozen=True)
class DriveImageFile:
    file_id: str
    name: str
    mime_type: str


def _drive_service(credentials_json_path: Path) -> Any:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(
        str(credentials_json_path),
        scopes=DRIVE_SCOPES,
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _iter_public_image_files_in_folder(
    folder_id: str,
    *,
    recursive: bool = False,
) -> Iterator[DriveImageFile]:
    seen_folders: set[str] = set()

    def walk(current_folder: str) -> Iterator[DriveImageFile]:
        if current_folder in seen_folders:
            return
        seen_folders.add(current_folder)

        with _open_url(_public_folder_url(current_folder)) as response:
            html = response.read().decode("utf-8", errors="replace")

        for href, title in _parse_public_entries(html):
            folder_match = _FOLDER_ID_RE.search(href)
            if folder_match:
                if recursive:
                    yield from walk(folder_match.group(1))
                continue

            file_match = re.search(r"/file/d/([a-zA-Z0-9_-]+)", href)
            if file_match and _is_image_name(title):
                yield DriveImageFile(
                    file_id=file_match.group(1),
                    name=title or file_match.group(1),
                    mime_type=mimetypes.guess_type(title)[0] or "image/jpeg",
                )

    yield from walk(folder_id)


def iter_image_files_in_folder(
    credentials_json_path: Path | None,
    folder_id: str,
    *,
    recursive: bool = False,
) -> Iterator[DriveImageFile]:
    try:
        files = sorted(
            list(_iter_public_image_files_in_folder(folder_id, recursive=recursive)),
            key=lambda item: item.name.lower(),
        )
        if files:
            yield from files
            return
    except Exception:
        if credentials_json_path is None or not credentials_json_path.is_file():
            raise RuntimeError(
                "Public Drive folder read failed. Make sure the folder is public and directly downloadable."
            ) from None

    if credentials_json_path is None or not credentials_json_path.is_file():
        raise RuntimeError(
            "Public Drive folder contained no readable images, and no Google credentials were provided for fallback access."
        )

    from googleapiclient.errors import HttpError

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
                    "Drive API list failed. Public folder access did not work and credential fallback also failed."
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


def _download_public_drive_file(file_id: str) -> tuple[bytes, str]:
    current_url = public_drive_file_url(file_id)
    content, headers, final_url = _read_url(current_url)
    if _looks_like_html(headers, content):
        confirm_url = _extract_confirm_url(content.decode("utf-8", errors="replace"), final_url)
        if confirm_url:
            content, headers, final_url = _read_url(confirm_url)
    disposition = headers.get("Content-Disposition", "") or headers.get("content-disposition", "")
    filename_match = re.search(r'filename="([^"]+)"', disposition)
    if filename_match:
        filename = filename_match.group(1)
    else:
        final_path = urlparse(final_url).path
        filename = Path(final_path).name or file_id
    return content, filename


def download_drive_file_to_temp(
    credentials_json_path: Path | None,
    file_id: str,
    *,
    suffix: str,
) -> Path:
    try:
        content, _ = _download_public_drive_file(file_id)
    except Exception:
        if credentials_json_path is None or not credentials_json_path.is_file():
            raise RuntimeError(f"Public Drive download failed for file {file_id}.") from None
    else:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            tmp.write(content)
            tmp.flush()
            path = Path(tmp.name)
        finally:
            tmp.close()
        return path

    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaIoBaseDownload

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
