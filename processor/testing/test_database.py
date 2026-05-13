from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import asyncio

from processor.mirage_processor.config import Settings
from processor.mirage_processor.database import (
    MirageDatabase,
    build_inference_status_updates,
)


def make_settings(*, data_dir: Path, public_base_url: str = "https://ascent-users.s3.amazonaws.com/") -> Settings:
    return Settings(
        supabase_url=None,
        supabase_service_role_key=None,
        mirage_database_url="postgresql://archive:archive-local-only@127.0.0.1:5432/archive_demo",
        supabase_storage_bucket="submissions",
        mirage_s3_bucket_name="ascent-users",
        mirage_s3_region="ap-south-1",
        mirage_s3_endpoint_url=None,
        mirage_s3_public_base_url=public_base_url,
        aws_access_key_id=None,
        aws_secret_access_key=None,
        aws_session_token=None,
        redis_url=None,
        data_dir=data_dir,
        default_threshold=0.35,
        review_threshold=0.35,
        match_top_k=5,
        match_margin=0.06,
        match_workers=2,
        anchor_workers=2,
        image_workers=2,
        anchor_batch_size=12,
        job_batch_size=50,
        poll_interval_seconds=20,
        insightface_model="buffalo_l",
        model_version="buffalo_l",
        preprocessing_version="face_preprocess_v1",
        detection_size=1280,
        detection_threshold=0.5,
        quality_threshold=0.8,
        onnx_providers=["CPUExecutionProvider"],
        google_application_credentials=None,
        required_anchor_count=6,
        processor_host="127.0.0.1",
        processor_port=8765,
        processor_allowed_origins=["http://localhost:4175"],
        processor_token=None,
        ops_backend_url="https://ascent.scaler.com",
        ops_admin_username="pseudo",
        ops_admin_password="goodnight@admin#123",
    )


class MirageDatabaseTests(TestCase):
    def test_approve_job_allows_failed_pairs_once_no_pairs_are_pending(self):
        with TemporaryDirectory() as tmp_dir:
            db = MirageDatabase(make_settings(data_dir=Path(tmp_dir)))

            class FakeConn:
                def __init__(self):
                    self.fetchval_calls = []
                    self.execute_calls = []

                async def fetchrow(self, query, *args):
                    if "from mirage_jobs" in query:
                        return {"id": "job-1"}
                    raise AssertionError(f"Unexpected fetchrow query: {query}")

                async def fetch(self, query, *args):
                    if "from mirage_job_images" in query:
                        return [{"status": "processed"}, {"status": "approved"}]
                    raise AssertionError(f"Unexpected fetch query: {query}")

                async def fetchval(self, query, *args):
                    self.fetchval_calls.append(query)
                    return 0

                async def execute(self, query, *args):
                    self.execute_calls.append(query)
                    return "UPDATE 1"

                async def close(self):
                    return None

            fake_conn = FakeConn()

            async def fake_connect(*args, **kwargs):
                return fake_conn

            with patch("processor.mirage_processor.database.asyncpg.connect", side_effect=fake_connect):
                result = asyncio.run(db._pg_approve_job("job-1"))

            self.assertEqual(result, {"jobId": "job-1", "status": "approved"})
            self.assertTrue(any("status = 'pending'" in query for query in fake_conn.fetchval_calls))
            self.assertEqual(len(fake_conn.execute_calls), 2)

    def test_build_inference_status_updates_marks_failed_images_as_failed_pairs(self):
        updates, positives = build_inference_status_updates(
            job_id="job-1",
            job={"id": "job-1", "event_id": "event-1"},
            image_map={
                "img-1": {
                    "id": "img-1",
                    "drive_file_id": "file-1",
                    "gdrive_url": "",
                    "download_url": "",
                }
            },
            analyzed=[
                {
                    "job_image_id": "img-1",
                    "sha256_value": "abc",
                    "faces": [],
                    "pair_results": [],
                    "pending_user_ids": ["user-1", "user-2"],
                    "error": "decoder failed",
                }
            ],
            attempt_map={
                ("img-1", "user-1"): 0,
                ("img-1", "user-2"): 2,
            },
            model_version="buffalo_l",
            preprocessing_version="face_preprocess_v1",
            now_dt="ts",
        )

        self.assertEqual(len(updates), 2)
        self.assertEqual(positives, [])
        self.assertEqual(updates[0][5], "failed")
        self.assertEqual(updates[0][9], "image_processing_failed")
        self.assertEqual(updates[0][10], 1)
        self.assertEqual(updates[1][10], 3)

    def test_download_anchor_image_url_encodes_storage_path(self):
        with TemporaryDirectory() as tmp_dir:
            db = MirageDatabase(make_settings(data_dir=Path(tmp_dir)))
            captured = {}

            class FakeResponse:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc, tb):
                    return False

                def read(self):
                    return b"image-bytes"

            def fake_urlopen(url):
                captured["url"] = url
                return FakeResponse()

            row = {
                "id": "img-1",
                "user_id": "user-1",
                "filename": "WhatsApp Image 2026-05-09 at 12.22.36 AM (2).jpeg",
                "storage_path": "mirage/user-anchors/user-1/abc_WhatsApp Image 2026-05-09 at 12.22.36 AM (2).jpeg",
            }

            with patch("processor.mirage_processor.database.urlopen", side_effect=fake_urlopen):
                local_path = db.download_anchor_image(row)

            self.assertTrue(local_path.exists())
            self.assertIn("%20", captured["url"])
            self.assertNotIn(" ", captured["url"])
