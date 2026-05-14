import unittest
import time
import threading
from pathlib import Path
from unittest.mock import patch, Mock

from fastapi.testclient import TestClient

from processor.mirage_processor.config import Settings
from processor.mirage_processor.server import (
    AUTO_ANCHOR_INTERVAL_SECONDS,
    ProcessorRunState,
    _run_auto_anchor_scheduler_tick,
    create_app,
)


class FakeWorker:
    def __init__(self, db=None):
        self.calls = []
        self.db = db

    def run_anchor_cycle(self, limit, user_id=None):
        self.calls.append(("anchors", limit, user_id))
        return {"processed": 1, "approved": 1, "rejected": 0}

    def run_job_by_id(self, job_id, batch_size):
        self.calls.append((job_id, batch_size))
        return {
            "jobs": 1,
            "images": 2,
            "pairs": 3,
            "positive": 1,
            "negative": 2,
            "failed": 0,
        }


def make_settings() -> Settings:
    return Settings(
        supabase_url="http://127.0.0.1:54321",
        supabase_service_role_key="service-role",
        mirage_database_url="postgresql://archive:archive-local-only@127.0.0.1:5432/archive_demo",
        supabase_storage_bucket="submissions",
        mirage_s3_bucket_name="ascent-users",
        mirage_s3_region="ap-south-1",
        mirage_s3_endpoint_url=None,
        mirage_s3_public_base_url=None,
        aws_access_key_id=None,
        aws_secret_access_key=None,
        aws_session_token=None,
        redis_url=None,
        data_dir=Path("processor/data"),
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
        processor_allowed_origins=["*"],
        processor_token=None,
        ops_backend_url="https://ascent.scaler.com",
        ops_admin_username="pseudo",
        ops_admin_password="goodnight@admin#123",
    )


class ProcessorServerTests(unittest.TestCase):
    def test_auto_anchor_interval_is_short_for_local_testing(self):
        self.assertEqual(AUTO_ANCHOR_INTERVAL_SECONDS, 10)

    def test_auto_anchor_tick_processes_pending_anchors_in_one_batch(self):
        worker = FakeWorker()
        run_state = ProcessorRunState()
        auto_status = {
            "enabled": True,
            "intervalSeconds": AUTO_ANCHOR_INTERVAL_SECONDS,
            "lastAttemptAt": None,
            "lastStartedAt": None,
            "lastCompletedAt": None,
            "lastSkippedReason": None,
            "lastError": None,
            "lastResult": None,
        }
        lock = threading.Lock()

        processed = _run_auto_anchor_scheduler_tick(
            settings=make_settings(),
            worker_factory=lambda: worker,
            lock=lock,
            run_state=run_state,
            auto_status=auto_status,
            latency_sink=Mock(),
        )

        self.assertTrue(processed)
        self.assertEqual(worker.calls, [("anchors", 12, None)])
        self.assertIsNone(auto_status["lastSkippedReason"])
        self.assertIsNone(auto_status["lastError"])
        self.assertEqual(auto_status["lastResult"]["approved"], 1)
        self.assertFalse(run_state.snapshot()["running"])
        self.assertEqual(run_state.snapshot()["kind"], "auto-anchors")

    def test_auto_anchor_tick_skips_when_processor_is_busy(self):
        worker = FakeWorker()
        run_state = ProcessorRunState()
        auto_status = {
            "enabled": True,
            "intervalSeconds": AUTO_ANCHOR_INTERVAL_SECONDS,
            "lastAttemptAt": None,
            "lastStartedAt": None,
            "lastCompletedAt": None,
            "lastSkippedReason": None,
            "lastError": None,
            "lastResult": None,
        }
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))

        try:
            processed = _run_auto_anchor_scheduler_tick(
                settings=make_settings(),
                worker_factory=lambda: worker,
                lock=lock,
                run_state=run_state,
                auto_status=auto_status,
                latency_sink=Mock(),
            )
        finally:
            lock.release()

        self.assertFalse(processed)
        self.assertEqual(worker.calls, [])
        self.assertEqual(auto_status["lastSkippedReason"], "busy")

    def test_auto_anchor_scheduler_runs_once_on_startup(self):
        worker = FakeWorker()
        app = create_app(settings=make_settings(), worker_factory=lambda: worker)

        with TestClient(app) as client:
            deadline = time.time() + 2.0
            payload = {}
            while time.time() < deadline:
                payload = client.get("/health").json()
                if payload.get("autoAnchor", {}).get("lastCompletedAt") is not None:
                    break
                time.sleep(0.05)

        self.assertTrue(worker.calls)
        self.assertEqual(worker.calls[0], ("anchors", 12, None))
        self.assertIsNotNone(payload["autoAnchor"]["lastCompletedAt"])

    def test_optimize_assets_endpoint_runs_optimizer(self):
        app = create_app(settings=make_settings(), worker_factory=lambda: FakeWorker())
        client = TestClient(app)

        fake_optimizer = Mock()
        fake_optimizer.run.return_value = {
            "jobId": "job-asset-1",
            "optimized": 3,
            "failed": 1,
            "rehydrated": 0,
        }

        with patch("processor.mirage_processor.server.JobAssetOptimizer", return_value=fake_optimizer):
            response = client.post("/jobs/job-asset-1/optimize-assets", json={"batchSize": 11})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "accepted")

            deadline = time.time() + 2.0
            status_payload = {}
            while time.time() < deadline:
                if fake_optimizer.run.call_count:
                    break
                status_payload = client.get("/runs/current").json()
                time.sleep(0.05)

        fake_optimizer.run.assert_called_once_with("job-asset-1", batch_size=11, retry_failed_only=False)
        if status_payload:
            self.assertEqual(status_payload.get("kind"), "optimize-assets")

    def test_process_job_endpoint_runs_requested_job(self):
        worker = FakeWorker()
        app = create_app(settings=make_settings(), worker_factory=lambda: worker)
        client = TestClient(app)

        response = client.post("/jobs/job-123/process", json={"batchSize": 7})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(worker.calls, [("anchors", 12, None), ("job-123", 7)])
        self.assertEqual(response.json()["jobId"], "job-123")
        self.assertEqual(response.json()["stats"]["positive"], 1)
        self.assertEqual(response.json()["anchors"]["approved"], 1)

    def test_process_anchors_endpoint_runs_anchor_cycle(self):
        worker = FakeWorker()
        app = create_app(worker_factory=lambda: worker)
        client = TestClient(app)

        response = client.post("/anchors/process", json={"anchorLimit": 4})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(worker.calls, [("anchors", 4, None)])
        self.assertEqual(response.json()["anchors"]["processed"], 1)

    def test_process_anchors_endpoint_accepts_user_scope(self):
        worker = FakeWorker()
        app = create_app(worker_factory=lambda: worker)
        client = TestClient(app)

        response = client.post("/anchors/process", json={"anchorLimit": 3, "userId": "user-123"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(worker.calls, [("anchors", 3, "user-123")])
        self.assertEqual(response.json()["anchors"]["approved"], 1)

    def test_process_anchors_resets_stale_processing_rows_for_user_scope(self):
        class FakeDb:
            def __init__(self):
                self.retry_calls = 0
                self.processing_calls = []

            def reset_retryable_anchor_images(self):
                self.retry_calls += 1

            def reset_processing_anchor_images(self, user_id=None):
                self.processing_calls.append(user_id)

        fake_db = FakeDb()
        worker = FakeWorker(db=fake_db)
        app = create_app(worker_factory=lambda: worker)
        client = TestClient(app)

        response = client.post("/anchors/process", json={"anchorLimit": 3, "userId": "user-123"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(fake_db.retry_calls, 1)
        self.assertEqual(fake_db.processing_calls, ["user-123"])

    def test_start_job_endpoint_accepts_background_run(self):
        worker = FakeWorker()
        app = create_app(settings=make_settings(), worker_factory=lambda: worker)
        client = TestClient(app)

        response = client.post("/jobs/job-789/start", json={"batchSize": 9})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "accepted")

        deadline = time.time() + 2.0
        status_payload = {}
        while time.time() < deadline:
            status_payload = client.get("/runs/current").json()
            if not status_payload.get("running"):
                break
            time.sleep(0.05)

        self.assertEqual(worker.calls, [("anchors", 12, None), ("job-789", 9)])
        self.assertEqual(status_payload.get("jobId"), "job-789")
        self.assertFalse(status_payload.get("running"))

    def test_health_prefers_remote_backend_database_status(self):
        login_response = Mock(status_code=200)
        login_response.json.return_value = {"access_token": "token-123"}
        jobs_response = Mock(status_code=200, text="[]")

        fake_httpx_client = Mock()
        fake_httpx_client.post.return_value = login_response
        fake_httpx_client.get.return_value = jobs_response

        fake_context_manager = Mock()
        fake_context_manager.__enter__ = Mock(return_value=fake_httpx_client)
        fake_context_manager.__exit__ = Mock(return_value=False)

        with patch("processor.mirage_processor.server._check_database", return_value=False), patch(
            "processor.mirage_processor.server.httpx.Client",
            return_value=fake_context_manager,
        ):
            app = create_app(settings=make_settings(), worker_factory=lambda: FakeWorker())
            client = TestClient(app)

            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["databaseConnected"])
        self.assertTrue(payload["backendDatabaseConnected"])
        self.assertFalse(payload["localDatabaseConnected"])
        self.assertIsNone(payload["backendDatabaseError"])
        self.assertGreater(payload["autoAnchor"]["nextRunAt"], 0)

    def test_unpublish_job_endpoint_calls_database(self):
        app = create_app(settings=make_settings(), worker_factory=lambda: FakeWorker())
        client = TestClient(app)

        fake_db = Mock()
        fake_db.unpublish_job.return_value = {"jobId": "job-1", "status": "unpublished"}

        with patch("processor.mirage_processor.server.MirageDatabase", return_value=fake_db):
            response = client.post("/jobs/job-1/unpublish")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "unpublished")
        fake_db.unpublish_job.assert_called_once_with("job-1")

    def test_delete_job_endpoint_cleans_assets_after_backend_delete(self):
        app = create_app(settings=make_settings(), worker_factory=lambda: FakeWorker())
        client = TestClient(app)

        fake_db = Mock()
        fake_db.get_job_asset_cleanup_plan.return_value = {
            "jobId": "job-1",
            "objectKeys": ["mirage/jobs/job-1/preview/img-1.webp"],
            "localPaths": ["processor/data/job-assets/job-1/inference/img-1.jpg"],
        }
        fake_db.execute_job_asset_cleanup.return_value = {
            "deletedS3ObjectCount": 1,
            "removedLocalDirectoryCount": 2,
        }

        login_response = Mock(status_code=200)
        login_response.json.return_value = {"access_token": "token-123"}
        delete_response = Mock(status_code=204, text="")

        fake_httpx_client = Mock()
        fake_httpx_client.post.return_value = login_response
        fake_httpx_client.delete.return_value = delete_response

        fake_context_manager = Mock()
        fake_context_manager.__enter__ = Mock(return_value=fake_httpx_client)
        fake_context_manager.__exit__ = Mock(return_value=False)

        with patch("processor.mirage_processor.server.MirageDatabase", return_value=fake_db), patch(
            "processor.mirage_processor.server.httpx.Client",
            return_value=fake_context_manager,
        ):
            response = client.delete("/jobs/job-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "deleted")
        fake_db.get_job_asset_cleanup_plan.assert_called_once_with("job-1")
        fake_db.execute_job_asset_cleanup.assert_called_once()


if __name__ == "__main__":
    unittest.main()
