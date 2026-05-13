from __future__ import annotations

import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

import numpy as np

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover - numpy fallback keeps tests working.
    faiss = None


def _normalize_vector(vector: np.ndarray) -> np.ndarray:
    array = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(array))
    if norm == 0:
        raise RuntimeError("Embedding vector has zero length.")
    return array / norm


@dataclass
class AnchorSearchStore:
    labels: list[dict[str, Any]]
    embeddings: np.ndarray

    def __post_init__(self) -> None:
        self.embeddings = np.asarray(self.embeddings, dtype=np.float32)
        self.dimension = int(self.embeddings.shape[1]) if self.embeddings.ndim == 2 and len(self.embeddings) > 0 else 0
        self._index = None
        self.user_labels: list[dict[str, Any]] = []
        self.user_embeddings = np.zeros((0, 0), dtype=np.float32)
        self.user_to_indices: dict[str, list[int]] = {}
        self._user_index = None
        if faiss is not None and self.dimension > 0 and len(self.embeddings) > 0:
            index = faiss.IndexFlatIP(self.dimension)
            index.add(self.embeddings)
            self._index = index
        self._build_user_templates()

    def _build_user_templates(self) -> None:
        if self.dimension == 0 or len(self.labels) == 0:
            return

        grouped: dict[str, list[int]] = {}
        for position, label in enumerate(self.labels):
            user_id = str(label["user_id"])
            grouped.setdefault(user_id, []).append(position)

        user_labels: list[dict[str, Any]] = []
        user_vectors: list[np.ndarray] = []
        for user_id, positions in grouped.items():
            user_label = next(
                (label for label in self.labels if str(label["user_id"]) == user_id),
                {"user_id": user_id, "display_name": "Unknown user"},
            )
            centroid = _normalize_vector(np.mean(self.embeddings[positions], axis=0))
            user_labels.append(
                {
                    "user_id": user_id,
                    "display_name": user_label.get("display_name") or "Unknown user",
                    "anchor_count": len(positions),
                }
            )
            user_vectors.append(centroid)
            self.user_to_indices[user_id] = positions

        self.user_labels = user_labels
        self.user_embeddings = (
            np.vstack(user_vectors).astype(np.float32)
            if user_vectors
            else np.zeros((0, self.dimension), dtype=np.float32)
        )
        if faiss is not None and len(self.user_embeddings) > 0:
            user_index = faiss.IndexFlatIP(self.dimension)
            user_index.add(self.user_embeddings)
            self._user_index = user_index

    def search(self, embedding: np.ndarray, k: int) -> list[tuple[dict[str, Any], float]]:
        if self.dimension == 0 or len(self.labels) == 0:
            return []
        query = _normalize_vector(embedding).reshape(1, -1)
        limit = min(max(1, k), len(self.labels))

        if self._index is not None:
            scores, positions = self._index.search(query, limit)
            return [
                (self.labels[int(position)], float(score))
                for score, position in zip(scores[0], positions[0], strict=True)
                if int(position) >= 0
            ]

        scores = np.dot(self.embeddings, query[0])
        positions = np.argsort(scores)[::-1][:limit]
        return [(self.labels[int(position)], float(scores[int(position)])) for position in positions]

    @property
    def user_count(self) -> int:
        return len(self.user_labels)

    def search_users(self, embedding: np.ndarray, k: int) -> list[tuple[dict[str, Any], float]]:
        if self.dimension == 0 or self.user_count == 0:
            return []
        query = _normalize_vector(embedding).reshape(1, -1)
        limit = min(max(1, k), self.user_count)

        if self._user_index is not None:
            scores, positions = self._user_index.search(query, limit)
            return [
                (self.user_labels[int(position)], float(score))
                for score, position in zip(scores[0], positions[0], strict=True)
                if int(position) >= 0
            ]

        scores = np.dot(self.user_embeddings, query[0])
        positions = np.argsort(scores)[::-1][:limit]
        return [(self.user_labels[int(position)], float(scores[int(position)])) for position in positions]

    def verify_user(
        self,
        embedding: np.ndarray,
        user_id: str,
    ) -> dict[str, Any] | None:
        positions = self.user_to_indices.get(str(user_id))
        if not positions:
            return None

        query = _normalize_vector(embedding)
        anchor_vectors = self.embeddings[positions]
        scores = np.dot(anchor_vectors, query)
        ranking = np.argsort(scores)[::-1]
        best_position = int(ranking[0])
        best_score = float(scores[best_position])
        top_scores = [float(scores[int(position)]) for position in ranking[: min(3, len(ranking))]]

        return {
            "user_id": str(user_id),
            "display_name": next(
                (
                    label.get("display_name") or "Unknown user"
                    for label in self.user_labels
                    if str(label["user_id"]) == str(user_id)
                ),
                "Unknown user",
            ),
            "best_score": best_score,
            "support_count": len(positions),
            "top_anchor_scores": top_scores,
            "best_anchor_id": self.labels[positions[best_position]].get("user_image_id")
            or self.labels[positions[best_position]].get("embedding_id"),
        }

    def match_user_against_faces(
        self,
        face_embeddings: list[np.ndarray],
        user_id: str,
    ) -> dict[str, Any] | None:
        best: dict[str, Any] | None = None
        for face_index, embedding in enumerate(face_embeddings):
            candidate = self.verify_user(embedding, user_id)
            if candidate is None:
                continue
            candidate = {**candidate, "face_index": face_index}
            if best is None or float(candidate["best_score"]) > float(best["best_score"]):
                best = candidate
        return best


class AnchorIndexCache:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.token_path = self.root_dir / "snapshot.token"
        self.labels_path = self.root_dir / "labels.json"
        self.embeddings_path = self.root_dir / "embeddings.npy"

    def load_or_build(self, db: Any) -> AnchorSearchStore:
        next_token = str(db.get_embedding_snapshot_token())
        if (
            self.token_path.exists()
            and self.labels_path.exists()
            and self.embeddings_path.exists()
            and self.token_path.read_text(encoding="utf-8") == next_token
        ):
            labels = json.loads(self.labels_path.read_text(encoding="utf-8"))
            embeddings = np.load(self.embeddings_path).astype(np.float32)
            return AnchorSearchStore(labels=labels, embeddings=embeddings)

        rows = list(db.get_approved_user_embeddings())
        labels: list[dict[str, Any]] = []
        vectors: list[np.ndarray] = []
        for row in rows:
            labels.append(
                {
                    "user_id": str(row["user_id"]),
                    "display_name": row.get("display_name") or "Unknown user",
                    "embedding_id": row.get("id"),
                    "user_image_id": row.get("user_image_id"),
                    "embedding_version": row.get("embedding_version"),
                }
            )
            vectors.append(_normalize_vector(np.asarray(row["embedding_vector"], dtype=np.float32)))

        embeddings = (
            np.vstack(vectors).astype(np.float32)
            if vectors
            else np.zeros((0, 0), dtype=np.float32)
        )
        store = AnchorSearchStore(labels=labels, embeddings=embeddings)
        self.labels_path.write_text(json.dumps(labels, indent=2), encoding="utf-8")
        np.save(self.embeddings_path, embeddings)
        self.token_path.write_text(next_token, encoding="utf-8")
        return store


class MirageWorker:
    def __init__(
        self,
        *,
        db: Any,
        face_engine: Any,
        index_cache: AnchorIndexCache | None,
        threshold: float,
        margin: float,
        review_threshold: float | None = None,
        top_k: int = 2,
        auto_support_min_hits: int = 2,
        review_support_min_hits: int = 1,
        match_workers: int = 1,
        anchor_workers: int = 1,
        image_workers: int = 1,
        face_engine_factory: Callable[[], Any] | None = None,
        telemetry: Any | None = None,
        progress_callback: Callable[[dict[str, Any] | None, str | None], None] | None = None,
    ) -> None:
        self.db = db
        self.face_engine = face_engine
        self.face_engine_factory = face_engine_factory
        self.index_cache = index_cache
        self.threshold = threshold
        self.margin = margin
        self.review_threshold = threshold if review_threshold is None else review_threshold
        self.top_k = max(2, top_k)
        self.auto_support_min_hits = max(1, auto_support_min_hits)
        self.review_support_min_hits = max(1, review_support_min_hits)
        self.match_workers = max(1, match_workers)
        self.anchor_workers = max(1, anchor_workers)
        self.image_workers = max(1, image_workers)
        self._engine_local = threading.local()
        self.telemetry = telemetry
        self.progress_callback = progress_callback

    @contextmanager
    def _timed(self, name: str, **fields: Any) -> Iterator[None]:
        if self.telemetry is None:
            yield
            return
        with self.telemetry.span(name, component="worker", **fields):
            yield

    def _engine_for_current_thread(self) -> Any:
        if self.face_engine_factory is None:
            return self.face_engine
        engine = getattr(self._engine_local, "engine", None)
        if engine is None:
            engine = self.face_engine_factory()
            self._engine_local.engine = engine
        return engine

    def _load_store(self) -> AnchorSearchStore:
        with self._timed("worker.load_store"):
            if self.index_cache is not None:
                return self.index_cache.load_or_build(self.db)

            rows = list(self.db.get_approved_user_embeddings())
            labels = [
                {
                    "user_id": str(row["user_id"]),
                    "display_name": row.get("display_name") or "Unknown user",
                    "embedding_id": row.get("id"),
                    "user_image_id": row.get("user_image_id"),
                    "embedding_version": row.get("embedding_version"),
                }
                for row in rows
            ]
            vectors = [
                _normalize_vector(np.asarray(row["embedding_vector"], dtype=np.float32))
                for row in rows
            ]
            embeddings = (
                np.vstack(vectors).astype(np.float32)
                if vectors
                else np.zeros((0, 0), dtype=np.float32)
            )
            return AnchorSearchStore(labels=labels, embeddings=embeddings)

    def _analyze_anchor_row(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._timed("worker.anchor_image", imageId=row.get("id"), userId=row.get("user_id")):
            engine = self._engine_for_current_thread()
            image_path = self.db.download_anchor_image(row)
            detect_anchor = getattr(engine, "detect_anchor", engine.detect)
            faces = list(detect_anchor(image_path))

            if len(faces) != 1:
                return {
                    "image_id": str(row["id"]),
                    "user_id": str(row["user_id"]),
                    "status": "rejected",
                    "quality_score": None,
                    "rejection_reason": f"Expected exactly one valid face, found {len(faces)}.",
                    "embedding": None,
                    "embedding_version": row.get("embedding_version"),
                    "model_name": getattr(getattr(engine, "settings", None), "insightface_model", None),
                }

            face = faces[0]
            quality_score = float(engine.quality_score(face))
            if not engine.has_valid_landmarks(face):
                return {
                    "image_id": str(row["id"]),
                    "user_id": str(row["user_id"]),
                    "status": "rejected",
                    "quality_score": quality_score,
                    "rejection_reason": "Landmark validation failed for this anchor image.",
                    "embedding": None,
                    "embedding_version": row.get("embedding_version"),
                    "model_name": getattr(getattr(engine, "settings", None), "insightface_model", None),
                }

            return {
                "image_id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "status": "approved",
                "quality_score": quality_score,
                "rejection_reason": None,
                "embedding": _normalize_vector(engine.embedding(face)).tolist(),
                "embedding_version": row.get("embedding_version"),
                "model_name": getattr(getattr(engine, "settings", None), "insightface_model", None),
            }

    def run_anchor_cycle(self, limit: int, user_id: str | None = None) -> dict[str, int]:
        with self._timed("worker.anchor_cycle", limit=limit, userId=user_id):
            rows = list(self.db.claim_pending_anchor_images(limit, user_id=user_id))
            stats = {"processed": 0, "approved": 0, "rejected": 0}

            if self.progress_callback is not None:
                self.progress_callback(
                    {"stage": "anchor-verification", "label": "anchor verification", "current": 0, "total": max(len(rows), 1), "percent": 0},
                    "Verifying anchor embeddings locally.",
                )

            if len(rows) <= 1 or self.anchor_workers == 1:
                results = [self._analyze_anchor_row(row) for row in rows]
            else:
                max_workers = min(self.anchor_workers, len(rows))
                with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mirage-anchor") as executor:
                    results = list(executor.map(self._analyze_anchor_row, rows))

            for index, result in enumerate(results, start=1):
                stats["processed"] += 1
                self.db.save_anchor_result(
                    image_id=result["image_id"],
                    user_id=result["user_id"],
                    status=result["status"],
                    quality_score=result["quality_score"],
                    rejection_reason=result["rejection_reason"],
                    embedding=result["embedding"],
                    embedding_version=result["embedding_version"],
                    model_name=result["model_name"],
                )
                if result["status"] == "approved":
                    stats["approved"] += 1
                else:
                    stats["rejected"] += 1
                if self.progress_callback is not None:
                    self.progress_callback(
                        {
                            "stage": "anchor-verification",
                            "label": "anchor verification",
                            "current": index,
                            "total": max(len(rows), 1),
                            "percent": round((index / max(len(rows), 1)) * 100),
                        },
                        "Verifying anchor embeddings locally.",
                    )

            return stats

    @staticmethod
    def _best_match_details(
        results: list[dict[str, Any]],
    ) -> tuple[dict[str, Any], float, float | None, float]:
        best = results[0]
        best_score = float(best["best_score"])
        runner_up_score = float(results[1]["best_score"]) if len(results) > 1 else None
        score_margin = float(best_score - runner_up_score) if runner_up_score is not None else float(best_score)
        return best, best_score, runner_up_score, score_margin

    def _face_outcome(self, face: Any, store: AnchorSearchStore, engine: Any | None = None) -> dict[str, Any]:
        engine = engine or self._engine_for_current_thread()
        quality_score = float(engine.quality_score(face))
        landmarks_valid = bool(engine.has_valid_landmarks(face))
        embedding = _normalize_vector(engine.embedding(face))
        candidate_user_limit = min(max(self.top_k * 4, 8), max(1, store.user_count))
        user_candidates = store.search_users(embedding, candidate_user_limit)
        results = [
            verified
            for verified in (
                store.verify_user(embedding, str(candidate["user_id"]))
                for candidate, _score in user_candidates
            )
            if verified is not None
        ]
        results.sort(key=lambda item: float(item["best_score"]), reverse=True)

        bbox = engine.bbox(face)
        landmarks = engine.landmarks(face)
        base = {
            "bbox": bbox,
            "landmarks": landmarks,
            "detection_score": quality_score,
            "quality_score": quality_score,
            "crop_path": None,
            "status": "unknown",
            "match": None,
        }

        if not results:
            return base

        best_label, best_score, second_score, score_margin = self._best_match_details(results)
        support_hits = sum(
            1 for score in best_label.get("top_anchor_scores", []) if float(score) >= self.review_threshold
        )

        if landmarks_valid and quality_score >= self.review_threshold and best_score >= self.threshold:
            base["status"] = "auto_accept_candidate"
            base["match"] = {
                "user_id": best_label["user_id"],
                "best_score": float(best_score),
                "second_best_score": float(second_score) if second_score is not None else None,
                "margin": score_margin,
                "auto_decision": "approved",
                "anchor_support_count": int(best_label.get("support_count") or 0),
                "support_hits_above_review_threshold": int(support_hits),
                "top_anchor_scores": list(best_label.get("top_anchor_scores") or []),
            }
            return base

        return base

    def run_job_cycle(self, batch_size: int) -> dict[str, int]:
        job = self.db.claim_next_job()
        if not job:
            return {"jobs": 0, "images": 0, "pairs": 0, "positive": 0, "negative": 0, "failed": 0}

        return self._run_claimed_job(job, batch_size=batch_size)

    def run_job_by_id(self, job_id: str, batch_size: int) -> dict[str, int]:
        if not hasattr(self.db, "claim_job_by_id"):
            raise RuntimeError("Database adapter does not support targeted job claims.")
        job = self.db.claim_job_by_id(job_id)
        if not job:
            return {"jobs": 0, "images": 0, "pairs": 0, "positive": 0, "negative": 0, "failed": 0}

        return self._run_claimed_job(job, batch_size=batch_size)

    def _analyze_job_image(
        self,
        *,
        job: dict[str, Any],
        row: dict[str, Any],
        store: AnchorSearchStore,
        pending_users: list[dict[str, Any]],
    ) -> dict[str, Any]:
        image_path: Path | None = None
        try:
            with self._timed("worker.job_image", jobId=job.get("id"), imageId=row.get("id"), pendingUsers=len(pending_users)):
                engine = self._engine_for_current_thread()
                image_path = self.db.download_job_image(row)
                sha256_value = self._file_sha256(image_path)
                detected_faces = list(engine.detect(image_path))
                face_payloads = [self._face_outcome(face, store, engine) for face in detected_faces]

                if not pending_users:
                    return {
                        "job_image_id": str(row["id"]),
                        "sha256_value": sha256_value,
                        "faces": face_payloads,
                        "pair_results": [],
                        "pending_user_ids": [],
                        "error": None,
                    }

                if not detected_faces:
                    return {
                        "job_image_id": str(row["id"]),
                        "sha256_value": sha256_value,
                        "faces": face_payloads,
                        "pair_results": [
                            {
                                "user_id": str(user["user_id"]),
                                "status": "negative",
                                "best_score": None,
                                "matched_face_index": None,
                                "matched_anchor_id": "",
                                "reason": "no_faces_detected",
                            }
                            for user in pending_users
                        ],
                        "pending_user_ids": [str(user["user_id"]) for user in pending_users],
                        "error": None,
                    }

                face_embeddings = [
                    _normalize_vector(engine.embedding(face))
                    for face in detected_faces
                ]
                pair_results = []
                for result in self._evaluate_pending_users(
                    store=store,
                    face_embeddings=face_embeddings,
                    pending_users=pending_users,
                ):
                    match = result.get("match")
                    is_positive = bool(result["is_positive"])
                    pair_results.append(
                        {
                            "user_id": str(result["user_id"]),
                            "status": "positive" if is_positive else ("failed" if match is None else "negative"),
                            "best_score": float(match["best_score"]) if match is not None else None,
                            "matched_face_index": int(match["face_index"]) if match is not None else None,
                            "matched_anchor_id": str(match.get("best_anchor_id") or "") if match is not None else "",
                            "reason": None if is_positive else ("no_valid_anchor_embeddings" if match is None else "below_threshold"),
                        }
                    )
                return {
                    "job_image_id": str(row["id"]),
                    "sha256_value": sha256_value,
                    "faces": face_payloads,
                    "pair_results": pair_results,
                    "pending_user_ids": [str(user["user_id"]) for user in pending_users],
                    "error": None,
                }
        except Exception as error:  # noqa: BLE001 - keep the poller alive.
            sha256_value = self._file_sha256(image_path) if image_path is not None else None
            return {
                "job_image_id": str(row["id"]),
                "sha256_value": sha256_value,
                "faces": [],
                "pair_results": [],
                "pending_user_ids": [str(user["user_id"]) for user in pending_users],
                "error": str(error),
            }

    def _run_claimed_job(self, job: dict[str, Any], *, batch_size: int) -> dict[str, int]:
        with self._timed("worker.job_cycle", jobId=job.get("id"), batchSize=batch_size):
            store = self._load_store()
            inference_state = {"images": 0, "users": 0}
            if hasattr(self.db, "initialize_inference_state"):
                inference_state = self.db.initialize_inference_state(job, store)
            stats = {"jobs": 1, "images": 0, "pairs": 0, "positive": 0, "negative": 0, "failed": 0}
            total_images_estimate = max(int(inference_state.get("images", 0)), 1)

            while True:
                rows = list(self.db.claim_job_images(str(job["id"]), batch_size))
                if not rows:
                    break
                row_inputs = []
                for row in rows:
                    pending_users = (
                        list(self.db.get_pending_users_for_image(str(job["id"]), str(row["id"])))
                        if hasattr(self.db, "get_pending_users_for_image")
                        else []
                    )
                    if not pending_users and hasattr(self.db, "get_pending_users_for_image"):
                        continue
                    row_inputs.append((row, pending_users))

                flush_chunk_size = max(1, min(self.image_workers, len(row_inputs)))
                completed_chunk: list[tuple[dict[str, Any], dict[str, Any]]] = []

                def update_stats(outcome: dict[str, Any]) -> None:
                    stats["images"] += 1
                    if outcome["error"] is not None:
                        failed_pairs = len(outcome.get("pending_user_ids") or [])
                        stats["pairs"] += failed_pairs
                        stats["failed"] += failed_pairs
                        return

                    for result in outcome["pair_results"]:
                        stats["pairs"] += 1
                        status_name = str(result["status"])
                        if status_name == "positive":
                            stats["positive"] += 1
                        elif status_name == "negative":
                            stats["negative"] += 1
                        else:
                            stats["failed"] += 1

                def flush_completed_chunk() -> None:
                    if not completed_chunk:
                        return

                    rows_only = [row for row, _outcome in completed_chunk]
                    analyzed = [outcome for _row, outcome in completed_chunk]
                    with self._timed("worker.flush_completed_chunk", jobId=job.get("id"), imageCount=len(rows_only)):
                        if hasattr(self.db, "save_job_batch_results"):
                            self.db.save_job_batch_results(
                                job=job,
                                rows=rows_only,
                                analyzed=analyzed,
                            )
                        else:
                            for row, outcome in zip(rows_only, analyzed, strict=True):
                                if outcome["error"] is not None:
                                    self.db.save_job_image_result(
                                        job_image_id=outcome["job_image_id"],
                                        status="failed",
                                        sha256_value=outcome["sha256_value"],
                                        faces=[],
                                        last_error=outcome["error"],
                                    )
                                    continue

                                self.db.save_job_image_result(
                                    job_image_id=outcome["job_image_id"],
                                    status="processed",
                                    sha256_value=outcome["sha256_value"],
                                    faces=outcome["faces"],
                                )
                                for result in outcome["pair_results"]:
                                    self.db.save_user_image_inference_result(
                                        job=job,
                                        image=row,
                                        user_id=str(result["user_id"]),
                                        status=str(result["status"]),
                                        best_score=result["best_score"],
                                        matched_face_index=result["matched_face_index"],
                                        matched_anchor_id=str(result["matched_anchor_id"] or ""),
                                        reason=result["reason"],
                                    )
                    completed_chunk.clear()

                    if self.progress_callback is not None:
                        current_images = min(stats["images"], total_images_estimate)
                        self.progress_callback(
                            {
                                "stage": "mapping",
                                "label": "mapping",
                                "current": current_images,
                                "total": total_images_estimate,
                                "percent": round((current_images / total_images_estimate) * 100),
                            },
                            "Mapping optimized images on the local GPU.",
                        )

                if len(row_inputs) <= 1 or self.image_workers == 1:
                    for row, pending_users in row_inputs:
                        outcome = self._analyze_job_image(job=job, row=row, store=store, pending_users=pending_users)
                        update_stats(outcome)
                        completed_chunk.append((row, outcome))
                        if len(completed_chunk) >= flush_chunk_size:
                            flush_completed_chunk()
                else:
                    max_workers = min(self.image_workers, len(row_inputs))
                    with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mirage-image") as executor:
                        future_map = {
                            executor.submit(
                                self._analyze_job_image,
                                job=job,
                                row=row,
                                store=store,
                                pending_users=pending_users,
                            ): row
                            for row, pending_users in row_inputs
                        }
                        for future in as_completed(future_map):
                            row = future_map[future]
                            outcome = future.result()
                            update_stats(outcome)
                            completed_chunk.append((row, outcome))
                            if len(completed_chunk) >= flush_chunk_size:
                                flush_completed_chunk()

                flush_completed_chunk()

                if len(rows) < batch_size:
                    break

            self.db.finalize_job_status(str(job["id"]))
            if self.progress_callback is not None:
                self.progress_callback(
                    {"stage": "mapping", "label": "mapping", "current": total_images_estimate, "total": total_images_estimate, "percent": 100},
                    "Mapping optimized images on the local GPU.",
                )
            return stats

    @staticmethod
    def _file_sha256(path: Path) -> str:
        import hashlib

        if not path.exists():
            return ""
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def run_once(self, *, anchor_limit: int, job_batch_size: int) -> dict[str, dict[str, int]]:
        return {
            "anchors": self.run_anchor_cycle(limit=anchor_limit),
            "jobs": self.run_job_cycle(batch_size=job_batch_size),
        }

    def _evaluate_pending_users(
        self,
        *,
        store: AnchorSearchStore,
        face_embeddings: list[np.ndarray],
        pending_users: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        def evaluate_user(user: dict[str, Any]) -> dict[str, Any]:
            user_id = str(user["user_id"])
            match = store.match_user_against_faces(face_embeddings, user_id)
            is_positive = bool(match is not None and float(match["best_score"]) >= self.threshold)
            return {
                "user_id": user_id,
                "match": match,
                "is_positive": is_positive,
            }

        if len(pending_users) <= 1 or self.match_workers == 1:
            return [evaluate_user(user) for user in pending_users]

        max_workers = min(self.match_workers, len(pending_users))
        ordered_results: dict[str, dict[str, Any]] = {}
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mirage-match") as executor:
            futures = {
                executor.submit(evaluate_user, user): str(user["user_id"])
                for user in pending_users
            }
            for future in as_completed(futures):
                result = future.result()
                ordered_results[str(result["user_id"])] = result

        return [
            ordered_results[str(user["user_id"])]
            for user in pending_users
            if str(user["user_id"]) in ordered_results
        ]

    def poll_forever(self, *, anchor_limit: int, job_batch_size: int, interval_seconds: int) -> None:
        while True:
            self.run_once(anchor_limit=anchor_limit, job_batch_size=job_batch_size)
            time.sleep(interval_seconds)
