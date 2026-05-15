from __future__ import annotations

import sys
import tempfile
import unittest
import threading
import time
from pathlib import Path

import numpy as np

PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
if str(PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(PROCESSOR_ROOT))

from mirage_processor.worker import AnchorIndexCache, MirageWorker


class FakeFace:
    def __init__(self, embedding: np.ndarray, score: float = 0.9):
        self.embedding = embedding
        self.normed_embedding = embedding
        self.det_score = score
        self.bbox = np.asarray([10.0, 10.0, 80.0, 80.0], dtype=np.float32)
        self.kps = np.asarray(
            [[20.0, 20.0], [60.0, 20.0], [40.0, 40.0], [25.0, 60.0], [55.0, 60.0]],
            dtype=np.float32,
        )


class FakeFaceEngine:
    def __init__(self, detections: dict[str, list[FakeFace]]):
        self.detections = detections
        self.detect_calls: list[str] = []

    def detect(self, image_path):
        self.detect_calls.append(str(image_path))
        return self.detections.get(str(image_path), [])

    def detect_anchor(self, image_path):
        return self.detect(image_path)

    @staticmethod
    def embedding(face: FakeFace) -> np.ndarray:
        return face.normed_embedding

    @staticmethod
    def bbox(face: FakeFace) -> dict[str, float]:
        x1, y1, x2, y2 = face.bbox
        return {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)}

    @staticmethod
    def landmarks(face: FakeFace) -> list[dict[str, float]]:
        return [{"x": float(x), "y": float(y)} for x, y in face.kps]

    @staticmethod
    def quality_score(face: FakeFace) -> float:
        return float(face.det_score)

    @staticmethod
    def has_valid_landmarks(face: FakeFace) -> bool:
        return True


class TrackingFaceEngine(FakeFaceEngine):
    def __init__(self, detections: dict[str, list[FakeFace]], delay: float = 0.05):
        super().__init__(detections)
        self.delay = delay
        self._lock = threading.Lock()
        self._active = 0
        self.max_active = 0

    def detect(self, image_path):
        with self._lock:
            self._active += 1
            self.max_active = max(self.max_active, self._active)
        try:
            time.sleep(self.delay)
            return super().detect(image_path)
        finally:
            with self._lock:
                self._active -= 1


class FakeDb:
    def __init__(self):
        self.anchor_rows = []
        self.anchor_results = []
        self.job_row = None
        self.job_images = []
        self.job_results = []
        self.job_batch_sizes = []
        self.finalized_jobs = []
        self.embedding_rows = []
        self.snapshot_token = "v1"
        self.pending_users_by_image = {}
        self.inference_results = []
        self.job_batch_results = []

    def claim_pending_anchor_images(self, limit: int, user_id: str | None = None):
        rows = self.anchor_rows[:limit]
        self.anchor_rows = self.anchor_rows[limit:]
        return rows

    def download_anchor_image(self, row):
        return Path(row["materialized_path"])

    def save_anchor_result(self, **payload):
        self.anchor_results.append(payload)

    def claim_next_job(self):
        row = self.job_row
        self.job_row = None
        return row

    def claim_job_images(self, job_id: str, batch_size: int):
        self.job_batch_sizes.append(batch_size)
        rows = self.job_images[:batch_size]
        self.job_images = self.job_images[batch_size:]
        return rows

    def download_job_image(self, row):
        return Path(row["materialized_path"])

    def save_job_image_result(self, **payload):
        self.job_results.append(payload)

    def finalize_job_status(self, job_id: str):
        self.finalized_jobs.append(job_id)

    def initialize_inference_state(self, job, store):
        return {"inserted": 0}

    def get_pending_users_for_image(self, job_id: str, image_id: str):
        if image_id in self.pending_users_by_image:
            return self.pending_users_by_image[image_id]
        user_ids = []
        for row in self.embedding_rows:
            user_id = str(row["user_id"])
            if user_id not in user_ids:
                user_ids.append(user_id)
        return [{"user_id": user_id} for user_id in user_ids]

    def save_user_image_inference_result(self, **payload):
        self.inference_results.append(payload)

    def save_job_batch_results(self, **payload):
        self.job_batch_results.append(payload)
        job = payload["job"]
        for row, outcome in zip(payload["rows"], payload["analyzed"], strict=True):
            if outcome["error"] is not None:
                self.save_job_image_result(
                    job_image_id=outcome["job_image_id"],
                    status="failed",
                    sha256_value=outcome["sha256_value"],
                    faces=[],
                    last_error=outcome["error"],
                )
                continue
            self.save_job_image_result(
                job_image_id=outcome["job_image_id"],
                status="processed",
                sha256_value=outcome["sha256_value"],
                faces=outcome["faces"],
            )
            for result in outcome["pair_results"]:
                self.save_user_image_inference_result(
                    job=job,
                    image=row,
                    user_id=str(result["user_id"]),
                    status=str(result["status"]),
                    best_score=result["best_score"],
                    matched_face_index=result["matched_face_index"],
                    matched_anchor_id=str(result["matched_anchor_id"] or ""),
                    reason=result["reason"],
                )

    def get_embedding_snapshot_token(self):
        return self.snapshot_token

    def get_approved_user_embeddings(self):
        return self.embedding_rows


class MirageWorkerTests(unittest.TestCase):
    def test_anchor_cycle_processes_multiple_images_in_parallel(self) -> None:
        db = FakeDb()
        db.anchor_rows = [
            {"id": "img-1", "user_id": "user-1", "materialized_path": "anchor-1.jpg", "embedding_version": 1},
            {"id": "img-2", "user_id": "user-2", "materialized_path": "anchor-2.jpg", "embedding_version": 1},
            {"id": "img-3", "user_id": "user-3", "materialized_path": "anchor-3.jpg", "embedding_version": 1},
        ]
        engine = TrackingFaceEngine(
            {
                "anchor-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "anchor-2.jpg": [FakeFace(np.asarray([0.0, 1.0], dtype=np.float32))],
                "anchor-3.jpg": [FakeFace(np.asarray([0.5, 0.5], dtype=np.float32))],
            }
        )
        worker = MirageWorker(
            db=db,
            face_engine=engine,
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            anchor_workers=3,
        )

        stats = worker.run_anchor_cycle(limit=10)

        self.assertEqual(stats["processed"], 3)
        self.assertEqual(stats["approved"], 3)
        self.assertGreaterEqual(engine.max_active, 2)

    def test_job_cycle_processes_multiple_images_in_parallel(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1", "event_id": "event-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"},
            {"id": "image-2", "drive_file_id": "file-2", "filename": "b.jpg", "materialized_path": "event-2.jpg"},
            {"id": "image-3", "drive_file_id": "file-3", "filename": "c.jpg", "materialized_path": "event-3.jpg"},
        ]
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "user_image_id": "anchor-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
        ]
        engine = TrackingFaceEngine(
            {
                "event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "event-2.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "event-3.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
            }
        )
        worker = MirageWorker(
            db=db,
            face_engine=engine,
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            image_workers=3,
        )

        stats = worker.run_job_cycle(batch_size=50)

        self.assertEqual(stats["images"], 3)
        self.assertEqual(stats["positive"], 3)
        self.assertGreaterEqual(engine.max_active, 2)

    def test_job_cycle_flushes_progress_in_incremental_chunks(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1", "event_id": "event-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"},
            {"id": "image-2", "drive_file_id": "file-2", "filename": "b.jpg", "materialized_path": "event-2.jpg"},
            {"id": "image-3", "drive_file_id": "file-3", "filename": "c.jpg", "materialized_path": "event-3.jpg"},
            {"id": "image-4", "drive_file_id": "file-4", "filename": "d.jpg", "materialized_path": "event-4.jpg"},
        ]
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "user_image_id": "anchor-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
        ]
        engine = TrackingFaceEngine(
            {
                "event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "event-2.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "event-3.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "event-4.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
            }
        )
        worker = MirageWorker(
            db=db,
            face_engine=engine,
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            image_workers=2,
        )

        stats = worker.run_job_cycle(batch_size=50)

        self.assertEqual(stats["images"], 4)
        self.assertEqual(len(db.job_batch_results), 2)
        self.assertEqual([len(batch["rows"]) for batch in db.job_batch_results], [2, 2])

    def test_anchor_cycle_rejects_images_without_exactly_one_face(self) -> None:
        db = FakeDb()
        db.anchor_rows = [
            {"id": "img-1", "user_id": "user-1", "materialized_path": "anchor-1.jpg", "embedding_version": 2}
        ]
        worker = MirageWorker(
            db=db,
            face_engine=FakeFaceEngine({"anchor-1.jpg": []}),
            index_cache=None,
            threshold=0.62,
            margin=0.06,
        )

        stats = worker.run_anchor_cycle(limit=10)

        self.assertEqual(stats["processed"], 1)
        self.assertEqual(db.anchor_results[0]["status"], "rejected")

    def test_job_cycle_claims_images_in_batches_of_fifty(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"}
        ]
        db.embedding_rows = [
            {"user_id": "user-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"}
        ]
        worker = MirageWorker(
            db=db,
            face_engine=FakeFaceEngine({"event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))]}),
            index_cache=None,
            threshold=0.62,
            margin=0.06,
        )

        worker.run_job_cycle(batch_size=50)

        self.assertEqual(db.job_batch_sizes, [50])

    def test_job_cycle_marks_low_identity_scores_unknown(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"}
        ]
        db.embedding_rows = [
            {"user_id": "user-1", "embedding_vector": [0.7, 0.3], "display_name": "User 1"},
            {"user_id": "user-2", "embedding_vector": [0.68, 0.32], "display_name": "User 2"},
        ]
        worker = MirageWorker(
            db=db,
            face_engine=FakeFaceEngine({"event-1.jpg": [FakeFace(np.asarray([0.69, 0.31], dtype=np.float32))]}),
            index_cache=None,
            threshold=0.95,
            margin=0.05,
        )

        worker.run_job_cycle(batch_size=50)

        self.assertEqual(db.job_results[0]["status"], "processed")
        self.assertEqual(db.job_results[0]["faces"][0]["status"], "unknown")
        self.assertIsNone(db.job_results[0]["faces"][0]["match"])
        self.assertEqual(db.finalized_jobs, ["job-1"])

    def test_job_cycle_ignores_second_anchor_from_same_user_in_margin_check(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"}
        ]
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
            {"id": "emb-2", "user_id": "user-1", "embedding_vector": [0.995, 0.005], "display_name": "User 1"},
            {"id": "emb-3", "user_id": "user-2", "embedding_vector": [0.0, 1.0], "display_name": "User 2"},
        ]
        worker = MirageWorker(
            db=db,
            face_engine=FakeFaceEngine({"event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))]}),
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            top_k=3,
        )

        worker.run_job_cycle(batch_size=50)

        self.assertEqual(db.job_results[0]["status"], "processed")
        face_payload = db.job_results[0]["faces"][0]
        self.assertEqual(face_payload["status"], "auto_accept_candidate")
        self.assertEqual(face_payload["match"]["user_id"], "user-1")
        self.assertGreater(face_payload["match"]["margin"], 0.9)

    def test_job_cycle_verifies_candidate_user_against_all_anchor_embeddings(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"}
        ]
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
            {"id": "emb-2", "user_id": "user-1", "embedding_vector": [0.0, 1.0], "display_name": "User 1"},
            {"id": "emb-3", "user_id": "user-2", "embedding_vector": [0.5, 0.5], "display_name": "User 2"},
        ]
        worker = MirageWorker(
            db=db,
            face_engine=FakeFaceEngine({"event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))]}),
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            top_k=2,
        )

        worker.run_job_cycle(batch_size=50)

        face_payload = db.job_results[0]["faces"][0]
        self.assertEqual(face_payload["status"], "auto_accept_candidate")
        self.assertEqual(face_payload["match"]["user_id"], "user-1")
        self.assertGreater(face_payload["match"]["best_score"], 0.99)
        self.assertGreater(face_payload["match"]["margin"], 0.1)

    def test_job_cycle_requires_multiple_anchor_hits_for_auto_accept(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"}
        ]
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
            {"id": "emb-2", "user_id": "user-1", "embedding_vector": [0.98, 0.02], "display_name": "User 1"},
            {"id": "emb-3", "user_id": "user-1", "embedding_vector": [0.96, 0.04], "display_name": "User 1"},
            {"id": "emb-4", "user_id": "user-2", "embedding_vector": [0.0, 1.0], "display_name": "User 2"},
        ]
        worker = MirageWorker(
            db=db,
            face_engine=FakeFaceEngine({"event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))]}),
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            review_threshold=0.55,
            top_k=3,
        )

        worker.run_job_cycle(batch_size=50)

        face_payload = db.job_results[0]["faces"][0]
        self.assertEqual(face_payload["status"], "auto_accept_candidate")
        self.assertEqual(face_payload["match"]["user_id"], "user-1")
        self.assertGreaterEqual(face_payload["match"]["support_hits_above_review_threshold"], 2)

    def test_anchor_index_cache_rebuilds_when_snapshot_token_changes(self) -> None:
        db = FakeDb()
        db.embedding_rows = [
            {"user_id": "user-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"}
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache = AnchorIndexCache(Path(tmp_dir))
            store_v1 = cache.load_or_build(db)
            self.assertEqual(cache.token_path.read_text(encoding="utf-8"), "v1")
            self.assertEqual(len(store_v1.labels), 1)

            db.snapshot_token = "v2"
            db.embedding_rows.append(
                {"user_id": "user-2", "embedding_vector": [0.0, 1.0], "display_name": "User 2"}
            )
            store_v2 = cache.load_or_build(db)

            self.assertEqual(cache.token_path.read_text(encoding="utf-8"), "v2")
            self.assertEqual(len(store_v2.labels), 2)

    def test_job_cycle_processes_only_pending_user_image_pairs(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1", "event_id": "event-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"}
        ]
        db.pending_users_by_image = {
            "image-1": [{"user_id": "user-2"}],
        }
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "user_image_id": "anchor-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
            {"id": "emb-2", "user_id": "user-2", "user_image_id": "anchor-2", "embedding_vector": [0.0, 1.0], "display_name": "User 2"},
        ]
        face_engine = FakeFaceEngine({"event-1.jpg": [FakeFace(np.asarray([0.0, 1.0], dtype=np.float32))]})
        worker = MirageWorker(
            db=db,
            face_engine=face_engine,
            index_cache=None,
            threshold=0.62,
            margin=0.06,
        )

        stats = worker.run_job_cycle(batch_size=50)

        self.assertEqual(face_engine.detect_calls, ["event-1.jpg"])
        self.assertEqual(stats["pairs"], 1)
        self.assertEqual(stats["positive"], 1)
        self.assertEqual(db.inference_results[0]["user_id"], "user-2")
        self.assertEqual(db.inference_results[0]["status"], "positive")
        self.assertEqual(db.inference_results[0]["matched_face_index"], 0)
        self.assertEqual(db.inference_results[0]["matched_anchor_id"], "anchor-2")

    def test_job_cycle_flushes_image_batch_results_in_bulk(self) -> None:
        db = FakeDb()
        db.job_row = {"id": "job-1", "event_id": "event-1"}
        db.job_images = [
            {"id": "image-1", "drive_file_id": "file-1", "filename": "a.jpg", "materialized_path": "event-1.jpg"},
            {"id": "image-2", "drive_file_id": "file-2", "filename": "b.jpg", "materialized_path": "event-2.jpg"},
        ]
        db.embedding_rows = [
            {"id": "emb-1", "user_id": "user-1", "user_image_id": "anchor-1", "embedding_vector": [1.0, 0.0], "display_name": "User 1"},
        ]
        face_engine = FakeFaceEngine(
            {
                "event-1.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
                "event-2.jpg": [FakeFace(np.asarray([1.0, 0.0], dtype=np.float32))],
            }
        )
        worker = MirageWorker(
            db=db,
            face_engine=face_engine,
            index_cache=None,
            threshold=0.62,
            margin=0.06,
            image_workers=2,
        )

        stats = worker.run_job_cycle(batch_size=50)

        self.assertEqual(stats["images"], 2)
        self.assertEqual(stats["pairs"], 2)
        self.assertEqual(len(db.job_batch_results), 1)
        batch_payload = db.job_batch_results[0]
        self.assertEqual(len(batch_payload["rows"]), 2)
        self.assertEqual(len(batch_payload["analyzed"]), 2)
        self.assertEqual(len(db.job_results), 2)
        self.assertEqual(len(db.inference_results), 2)


if __name__ == "__main__":
    unittest.main()
