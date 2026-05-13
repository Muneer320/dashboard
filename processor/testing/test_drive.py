from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
if str(PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(PROCESSOR_ROOT))

from mirage_processor.drive import download_drive_file_to_temp, iter_image_files_in_folder


class _FakeResponse:
    def __init__(self, body: bytes, headers: dict[str, str] | None = None, url: str = "https://drive.google.com/mock"):
        self._body = body
        self.headers = headers or {}
        self._url = url

    def read(self) -> bytes:
        return self._body

    def geturl(self) -> str:
        return self._url

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class PublicDriveTests(unittest.TestCase):
    def test_iter_image_files_in_folder_reads_public_embedded_folder(self) -> None:
        html = b"""
        <a href="https://drive.google.com/file/d/fileA/view" target="_blank"><div class="flip-entry-title">first.jpg</div></a>
        <a href="https://drive.google.com/file/d/fileB/view" target="_blank"><div class="flip-entry-title">second.png</div></a>
        """

        with patch("mirage_processor.drive._open_url", return_value=_FakeResponse(html)):
            files = list(iter_image_files_in_folder(None, "folder123"))

        self.assertEqual([file.file_id for file in files], ["fileA", "fileB"])
        self.assertEqual([file.name for file in files], ["first.jpg", "second.png"])

    def test_download_drive_file_to_temp_uses_public_download(self) -> None:
        response = _FakeResponse(
            b"binary-image",
            headers={"Content-Disposition": 'attachment; filename="sample.jpg"'},
        )

        with patch("mirage_processor.drive._open_url", return_value=response):
            path = download_drive_file_to_temp(None, "file123", suffix=".jpg")

        try:
            self.assertTrue(path.exists())
            self.assertEqual(path.read_bytes(), b"binary-image")
        finally:
            path.unlink(missing_ok=True)

    def test_download_drive_file_to_temp_follows_confirm_form(self) -> None:
        confirm_html = b"""
        <html>
          <form id="download-form" action="https://drive.usercontent.google.com/download">
            <input type="hidden" name="id" value="file123" />
            <input type="hidden" name="confirm" value="t" />
            <input type="hidden" name="export" value="download" />
          </form>
        </html>
        """
        final_response = _FakeResponse(
            b"real-image-bytes",
            headers={"Content-Disposition": 'attachment; filename="confirmed.png"'},
        )

        responses = [
            _FakeResponse(confirm_html, headers={"Content-Type": "text/html"}, url="https://drive.google.com/uc?export=download&id=file123"),
            final_response,
        ]

        with patch("mirage_processor.drive._open_url", side_effect=responses):
            path = download_drive_file_to_temp(None, "file123", suffix=".png")

        try:
            self.assertEqual(path.read_bytes(), b"real-image-bytes")
        finally:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
