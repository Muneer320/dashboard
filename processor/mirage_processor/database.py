from __future__ import annotations

import asyncio
import json
import shutil
import socket
import time
from contextlib import contextmanager, nullcontext
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import quote
from urllib.request import urlopen

try:
    import asyncpg
except ImportError:  # pragma: no cover - local runtime fallback
    asyncpg = None
import boto3
from botocore.config import Config as BotoConfig
from supabase import Client, create_client

from .drive import download_drive_file_to_temp, drive_file_view_url, public_drive_file_url
from .config import Settings
from .normalize import normalize_identifier


def is_undefined_column_error(error: Exception) -> bool:
    return bool(asyncpg is not None and isinstance(error, asyncpg.UndefinedColumnError)) or getattr(error, "sqlstate", None) == "42703"


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def utc_now_dt() -> datetime:
    return datetime.now(UTC)


def build_inference_status_updates(
    *,
    job_id: str,
    job: dict[str, Any],
    image_map: dict[str, dict[str, Any]],
    analyzed: list[dict[str, Any]],
    attempt_map: dict[tuple[str, str], int],
    model_version: str,
    preprocessing_version: str,
    now_dt: Any,
) -> tuple[list[tuple[Any, ...]], list[tuple[Any, ...]]]:
    inference_params: list[tuple[Any, ...]] = []
    positive_params: list[tuple[Any, ...]] = []

    for outcome in analyzed:
        image = image_map.get(str(outcome["job_image_id"]))
        if image is None:
            continue

        drive_file_id = image.get("drive_file_id") or ""
        gdrive_url = image.get("gdrive_url") or drive_file_view_url(drive_file_id)
        download_url = image.get("download_url") or public_drive_file_url(drive_file_id)
        image_id = str(outcome["job_image_id"])

        if outcome["error"] is not None:
            pending_user_ids = [str(user_id) for user_id in (outcome.get("pending_user_ids") or [])]
            for user_id in pending_user_ids:
                inference_params.append(
                    (
                        job_id,
                        image_id,
                        user_id,
                        model_version,
                        preprocessing_version,
                        "failed",
                        None,
                        None,
                        "",
                        "image_processing_failed",
                        attempt_map.get((image_id, user_id), 0) + 1,
                        now_dt,
                    )
                )
            continue

        for result in outcome["pair_results"]:
            user_id = str(result["user_id"])
            matched_anchor_id = str(result["matched_anchor_id"] or "")
            inference_params.append(
                (
                    job_id,
                    image_id,
                    user_id,
                    model_version,
                    preprocessing_version,
                    str(result["status"]),
                    result["best_score"],
                    result["matched_face_index"],
                    matched_anchor_id,
                    result["reason"],
                    attempt_map.get((image_id, user_id), 0) + 1,
                    now_dt,
                )
            )
            if str(result["status"]) == "positive":
                positive_params.append(
                    (
                        job.get("event_id"),
                        job_id,
                        image_id,
                        drive_file_id,
                        user_id,
                        gdrive_url,
                        download_url,
                        result["best_score"],
                        result["matched_face_index"],
                        matched_anchor_id,
                        model_version,
                        preprocessing_version,
                    )
                )

    return inference_params, positive_params


class MirageDatabase:
    def __init__(self, settings: Settings, telemetry: Any | None = None) -> None:
        self.settings = settings
        self.telemetry = telemetry
        self.database_url = settings.mirage_database_url if asyncpg is not None else None
        self.client: Client | None = None
        self.bucket = None
        if settings.supabase_url and settings.supabase_service_role_key:
            self.client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
            self.bucket = self.client.storage.from_(settings.supabase_storage_bucket)
        self.worker_id = socket.gethostname()

    @contextmanager
    def _timed(self, name: str, **fields: Any) -> Iterator[None]:
        if self.telemetry is None:
            yield
            return
        with self.telemetry.span(name, component="database", **fields):
            yield

    def _run_pg(self, coroutine):
        return asyncio.run(coroutine)

    async def _pg_profile_for_user(self, user_id: str) -> dict[str, Any] | None:
        if not self.database_url:
            return None
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            row = await conn.fetchrow(
                """
                select user_id, consent_enabled, approved_anchor_count, enrollment_status,
                       last_embedding_version, last_processed_at
                from mirage_user_profiles
                where user_id = $1::uuid
                limit 1
                """,
                user_id,
            )
            return dict(row) if row else None
        finally:
            await conn.close()

    async def _pg_is_available(self) -> bool:
        if not self.database_url:
            return False
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            await conn.fetchval("select 1")
            return True
        finally:
            await conn.close()

    async def _pg_get_embedding_snapshot_token(self) -> str:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            rows = await conn.fetch(
                """
                select user_id::text as user_id,
                       last_embedding_version,
                       updated_at,
                       approved_anchor_count,
                       consent_enabled
                from mirage_user_profiles
                order by user_id
                """
            )
            payload = json.dumps([dict(row) for row in rows], sort_keys=True, default=str)
            return sha256(payload.encode("utf-8")).hexdigest()
        finally:
            await conn.close()

    async def _pg_get_approved_user_embeddings(self) -> list[dict[str, Any]]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            rows = await conn.fetch(
                """
                select e.id::text as id,
                       e.user_id::text as user_id,
                       e.user_image_id::text as user_image_id,
                       e.embedding_vector,
                       e.quality_score,
                       e.model_name,
                       e.model_version,
                       e.preprocessing_version,
                       e.embedding_version,
                       u.name as display_name
                from mirage_user_profiles p
                join mirage_user_embeddings e on e.user_id = p.user_id
                left join users u on u.id = e.user_id
                where p.consent_enabled = true
                  and p.approved_anchor_count >= $1
                  and e.model_version = $2
                  and e.preprocessing_version = $3
                order by e.user_id, e.id
                """,
                self.settings.required_anchor_count,
                self.settings.model_version,
                self.settings.preprocessing_version,
            )
            result: list[dict[str, Any]] = []
            for row in rows:
                item = dict(row)
                vector = item.get("embedding_vector")
                if isinstance(vector, str):
                    item["embedding_vector"] = json.loads(vector)
                result.append(item)
            return result
        finally:
            await conn.close()

    async def _pg_initialize_inference_state(self, job: dict[str, Any], store: Any) -> dict[str, int]:
        job_id = str(job["id"])
        event_id = job.get("event_id")
        force_recheck = bool(job.get("force_recheck", False))
        user_ids = sorted({str(label["user_id"]) for label in getattr(store, "user_labels", [])})
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            image_rows = await conn.fetch(
                """
                select id, drive_file_id
                from mirage_job_images
                where job_id = $1::uuid
                order by display_order
                """,
                job_id,
            )
            existing_count = await conn.fetchval(
                """
                select count(*)::int
                from inference_user_image_status
                where job_id = $1::uuid
                  and model_version = $2
                  and preprocessing_version = $3
                """,
                job_id,
                self.settings.model_version,
                self.settings.preprocessing_version,
            )
            inserted = 0
            for image in image_rows:
                for user_id in user_ids:
                    result = await conn.execute(
                        """
                        insert into inference_user_image_status (
                            event_id, job_id, image_id, gdrive_file_id, user_id,
                            status, model_version, preprocessing_version
                        ) values (
                            $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
                            'pending', $6, $7
                        )
                        on conflict (job_id, image_id, user_id, model_version, preprocessing_version)
                        do nothing
                        """,
                        event_id,
                        job_id,
                        str(image["id"]),
                        image.get("drive_file_id"),
                        user_id,
                        self.settings.model_version,
                        self.settings.preprocessing_version,
                    )
                    if result.endswith(" 1"):
                        inserted += 1

            reset = 0
            if force_recheck:
                result = await conn.execute(
                    """
                    update inference_user_image_status
                    set status = 'pending',
                        best_score = null,
                        matched_face_index = null,
                        matched_anchor_id = null,
                        reason = 'force_recheck',
                        last_inferred_at = null,
                        updated_at = now()
                    where job_id = $1::uuid
                      and model_version = $2
                      and preprocessing_version = $3
                      and status in ('positive', 'negative', 'failed')
                    """,
                    job_id,
                    self.settings.model_version,
                    self.settings.preprocessing_version,
                )
                reset = int(result.rsplit(" ", 1)[-1])
            return {"images": len(image_rows), "users": len(user_ids), "inserted": inserted, "reset": reset, "existing": int(existing_count or 0)}
        finally:
            await conn.close()

    async def _pg_claim_job_by_id(self, job_id: str) -> dict[str, Any] | None:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            row = await conn.fetchrow("select * from mirage_jobs where id = $1::uuid limit 1", job_id)
            if row is None:
                return None
            row_dict = dict(row)
            patch_status = row_dict.get("status")
            if patch_status in {"pending", "rerun_pending"}:
                updated = await conn.fetchrow(
                    """
                    update mirage_jobs
                    set status = 'processing',
                        claimed_by = $2,
                        claimed_at = $3,
                        updated_at = now()
                    where id = $1::uuid
                    returning *
                    """,
                    job_id,
                    self.worker_id,
                    utc_now_dt(),
                )
                return dict(updated) if updated else None
            return row_dict
        finally:
            await conn.close()

    async def _pg_claim_job_images(self, job_id: str, batch_size: int) -> list[dict[str, Any]]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            try:
                pending_rows = await conn.fetch(
                    """
                    select status.image_id::text as image_id
                    from inference_user_image_status status
                    join mirage_job_images image on image.id = status.image_id
                    where status.job_id = $1::uuid
                      and status.status = 'pending'
                      and status.model_version = $2
                      and status.preprocessing_version = $3
                      and image.asset_status = 'ready'
                    limit $4
                    """,
                    job_id,
                    self.settings.model_version,
                    self.settings.preprocessing_version,
                    batch_size * 20,
                )
            except Exception as exc:
                if not is_undefined_column_error(exc):
                    raise
                pending_rows = await conn.fetch(
                    """
                    select status.image_id::text as image_id
                    from inference_user_image_status status
                    join mirage_job_images image on image.id = status.image_id
                    where status.job_id = $1::uuid
                      and status.status = 'pending'
                      and status.model_version = $2
                      and status.preprocessing_version = $3
                    limit $4
                    """,
                    job_id,
                    self.settings.model_version,
                    self.settings.preprocessing_version,
                    batch_size * 20,
                )
            pending_image_ids: list[str] = []
            for row in pending_rows:
                image_id = str(row["image_id"])
                if image_id not in pending_image_ids:
                    pending_image_ids.append(image_id)
                if len(pending_image_ids) >= batch_size:
                    break
            if not pending_image_ids:
                return []
            image_rows = await conn.fetch(
                """
                select *
                from mirage_job_images
                where id = any($1::uuid[])
                order by display_order
                """,
                pending_image_ids,
            )
            return [dict(row) for row in image_rows]
        finally:
            await conn.close()

    async def _pg_get_pending_users_for_image(self, job_id: str, image_id: str) -> list[dict[str, Any]]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            rows = await conn.fetch(
                """
                select id::text as id, user_id::text as user_id
                from inference_user_image_status
                where job_id = $1::uuid
                  and image_id = $2::uuid
                  and status = 'pending'
                  and model_version = $3
                  and preprocessing_version = $4
                """,
                job_id,
                image_id,
                self.settings.model_version,
                self.settings.preprocessing_version,
            )
            return [dict(row) for row in rows]
        finally:
            await conn.close()

    async def _pg_get_job_asset_counts(self, job_id: str) -> dict[str, int]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            try:
                row = await conn.fetchrow(
                    """
                    select
                        count(*)::int as total_count,
                        count(*) filter (where asset_status = 'ready')::int as ready_count,
                        count(*) filter (where asset_status = 'failed')::int as failed_count
                    from mirage_job_images
                    where job_id = $1::uuid
                    """,
                    job_id,
                )
                total = int(row["total_count"] or 0) if row else 0
                ready = int(row["ready_count"] or 0) if row else 0
                failed = int(row["failed_count"] or 0) if row else 0
            except Exception as exc:
                if not is_undefined_column_error(exc):
                    raise
                total = int(
                    await conn.fetchval(
                        """
                        select count(*)::int
                        from mirage_job_images
                        where job_id = $1::uuid
                        """,
                        job_id,
                    )
                    or 0
                )
                ready = total
                failed = 0
            return {
                "total": total,
                "ready": ready,
                "failed": failed,
            }
        finally:
            await conn.close()

    async def _pg_get_job_asset_cleanup_plan(self, job_id: str) -> dict[str, Any]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            job_row = await conn.fetchrow(
                "select id::text as id from mirage_jobs where id = $1::uuid limit 1",
                job_id,
            )
            if job_row is None:
                raise LookupError("Mirage job not found.")
            try:
                asset_rows = await conn.fetch(
                    """
                    select thumb_storage_key, preview_storage_key, inference_local_path
                    from mirage_job_images
                    where job_id = $1::uuid
                    """,
                    job_id,
                )
            except Exception as exc:
                if not is_undefined_column_error(exc):
                    raise
                asset_rows = []
            object_keys: list[str] = []
            local_paths: list[str] = []
            for raw_row in asset_rows:
                row = dict(raw_row)
                for key_name in ("thumb_storage_key", "preview_storage_key"):
                    object_key = row.get(key_name)
                    if object_key:
                        object_keys.append(str(object_key))
                local_path = row.get("inference_local_path")
                if local_path:
                    local_paths.append(str(local_path))
            return {
                "jobId": str(job_row["id"]),
                "objectKeys": sorted(set(object_keys)),
                "localPaths": sorted(set(local_paths)),
            }
        finally:
            await conn.close()

    async def _pg_save_user_image_inference_result(self, *, job: dict[str, Any], image: dict[str, Any], user_id: str, status: str, best_score: float | None = None, matched_face_index: int | None = None, matched_anchor_id: str | None = None, reason: str | None = None) -> None:
        job_id = str(job["id"])
        image_id = str(image["id"])
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            existing_count = await conn.fetchval(
                """
                select inference_attempt_count
                from inference_user_image_status
                where job_id = $1::uuid
                  and image_id = $2::uuid
                  and user_id = $3::uuid
                  and model_version = $4
                  and preprocessing_version = $5
                limit 1
                """,
                job_id,
                image_id,
                user_id,
                self.settings.model_version,
                self.settings.preprocessing_version,
            )
            await conn.execute(
                """
                update inference_user_image_status
                set status = $6,
                    best_score = $7,
                    matched_face_index = $8,
                    matched_anchor_id = nullif($9, '')::uuid,
                    reason = $10,
                    inference_attempt_count = $11,
                    last_inferred_at = $12,
                    updated_at = now()
                where job_id = $1::uuid
                  and image_id = $2::uuid
                  and user_id = $3::uuid
                  and model_version = $4
                  and preprocessing_version = $5
                  and status = 'pending'
                """,
                job_id,
                image_id,
                user_id,
                self.settings.model_version,
                self.settings.preprocessing_version,
                status,
                best_score,
                matched_face_index,
                matched_anchor_id or "",
                reason,
                int(existing_count or 0) + 1,
                utc_now_dt(),
            )
            if status == "positive":
                drive_file_id = image.get("drive_file_id") or ""
                await conn.execute(
                    """
                    insert into image_user_mappings (
                        event_id, job_id, image_id, gdrive_file_id, user_id,
                        gdrive_url, download_url, best_score, matched_face_index,
                        matched_anchor_id, model_version, preprocessing_version
                    ) values (
                        $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
                        $6, $7, $8, $9, nullif($10, '')::uuid, $11, $12
                    )
                    on conflict (job_id, image_id, user_id, model_version, preprocessing_version)
                    do update set
                        gdrive_file_id = excluded.gdrive_file_id,
                        gdrive_url = excluded.gdrive_url,
                        download_url = excluded.download_url,
                        best_score = excluded.best_score,
                        matched_face_index = excluded.matched_face_index,
                        matched_anchor_id = excluded.matched_anchor_id,
                        updated_at = now()
                    """,
                    job.get("event_id"),
                    job_id,
                    image_id,
                    drive_file_id,
                    user_id,
                    image.get("gdrive_url") or drive_file_view_url(drive_file_id),
                    image.get("download_url") or public_drive_file_url(drive_file_id),
                    best_score,
                    matched_face_index,
                    matched_anchor_id or "",
                    self.settings.model_version,
                    self.settings.preprocessing_version,
                )
        finally:
            await conn.close()

    async def _pg_save_job_image_result(self, *, job_image_id: str, status: str, sha256_value: str | None = None, faces: list[dict[str, Any]] | None = None, last_error: str | None = None) -> None:
        faces = faces or []
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            image_row = await conn.fetchrow(
                "select job_id, status from mirage_job_images where id = $1::uuid limit 1",
                job_image_id,
            )
            if image_row is None:
                return
            current_status = str(image_row["status"] or "pending")
            next_status = current_status if current_status == "approved" and status in {"processed", "failed"} else status
            await conn.execute(
                """
                update mirage_job_images
                set status = $2,
                    sha256 = $3,
                    last_error = $4,
                    download_status = $5,
                    face_detection_status = $6,
                    detected_face_count = $7,
                    updated_at = now()
                where id = $1::uuid
                """,
                job_image_id,
                next_status,
                sha256_value,
                last_error,
                "downloaded" if last_error is None else "failed",
                "completed" if last_error is None else "failed",
                len(faces),
            )
            existing_face_ids = await conn.fetch(
                "select id::text as id from mirage_detected_faces where job_image_id = $1::uuid",
                job_image_id,
            )
            face_ids = [row["id"] for row in existing_face_ids]
            if face_ids:
                await conn.execute("delete from mirage_face_matches where face_id = any($1::uuid[])", face_ids)
            await conn.execute("delete from mirage_detected_faces where job_image_id = $1::uuid", job_image_id)

            for face in faces:
                face_row = await conn.fetchrow(
                    """
                    insert into mirage_detected_faces (
                        job_image_id, bbox, landmarks, detection_score, quality_score, crop_path, status
                    ) values ($1::uuid, $2::jsonb, $3::jsonb, $4, $5, $6, $7)
                    returning id
                    """,
                    job_image_id,
                    json.dumps(face.get("bbox") or {}),
                    json.dumps(face.get("landmarks") or []),
                    face.get("detection_score"),
                    face.get("quality_score"),
                    face.get("crop_path"),
                    face.get("status") or "unknown",
                )
                match = face.get("match")
                if face_row is None or not match:
                    continue
                await conn.execute(
                    """
                    insert into mirage_face_matches (
                        face_id, user_id, best_score, second_best_score, margin, auto_decision
                    ) values ($1::uuid, $2::uuid, $3, $4, $5, $6)
                    """,
                    str(face_row["id"]),
                    match.get("user_id"),
                    match.get("best_score"),
                    match.get("second_best_score"),
                    match.get("margin"),
                    match.get("auto_decision"),
                )
            job_id = str(image_row["job_id"])
        finally:
            await conn.close()
        await self._pg_finalize_job_status(job_id)

    async def _pg_save_job_batch_results(
        self,
        *,
        job: dict[str, Any],
        rows: list[dict[str, Any]],
        analyzed: list[dict[str, Any]],
    ) -> None:
        if not analyzed:
            return
        job_id = str(job["id"])
        image_map = {str(row["id"]): row for row in rows}
        image_ids = [str(outcome["job_image_id"]) for outcome in analyzed]
        now_dt = utc_now_dt()
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            async with conn.transaction():
                image_rows = await conn.fetch(
                    """
                    select id::text as id, job_id::text as job_id, status
                    from mirage_job_images
                    where id = any($1::uuid[])
                    """,
                    image_ids,
                )
                image_row_map = {str(row["id"]): dict(row) for row in image_rows}
                update_params = []
                for outcome in analyzed:
                    job_image_id = str(outcome["job_image_id"])
                    image_row = image_row_map.get(job_image_id)
                    if image_row is None:
                        continue
                    current_status = str(image_row.get("status") or "pending")
                    status = "failed" if outcome["error"] is not None else "processed"
                    next_status = current_status if current_status == "approved" and status in {"processed", "failed"} else status
                    update_params.append(
                        (
                            job_image_id,
                            next_status,
                            outcome["sha256_value"],
                            outcome["error"],
                            "downloaded" if outcome["error"] is None else "failed",
                            "completed" if outcome["error"] is None else "failed",
                            len(outcome["faces"]),
                        )
                    )
                if update_params:
                    await conn.executemany(
                        """
                        update mirage_job_images
                        set status = $2,
                            sha256 = $3,
                            last_error = $4,
                            download_status = $5,
                            face_detection_status = $6,
                            detected_face_count = $7,
                            updated_at = now()
                        where id = $1::uuid
                        """,
                        update_params,
                    )

                attempt_rows = await conn.fetch(
                    """
                    select image_id::text as image_id,
                           user_id::text as user_id,
                           inference_attempt_count
                    from inference_user_image_status
                    where job_id = $1::uuid
                      and image_id = any($2::uuid[])
                      and model_version = $3
                      and preprocessing_version = $4
                    """,
                    job_id,
                    image_ids,
                    self.settings.model_version,
                    self.settings.preprocessing_version,
                )
                attempt_map = {
                    (str(row["image_id"]), str(row["user_id"])): int(row["inference_attempt_count"] or 0)
                    for row in attempt_rows
                }

                inference_params, positive_params = build_inference_status_updates(
                    job_id=job_id,
                    job=job,
                    image_map=image_map,
                    analyzed=analyzed,
                    attempt_map=attempt_map,
                    model_version=self.settings.model_version,
                    preprocessing_version=self.settings.preprocessing_version,
                    now_dt=now_dt,
                )

                if inference_params:
                    await conn.executemany(
                        """
                        update inference_user_image_status
                        set status = $6,
                            best_score = $7,
                            matched_face_index = $8,
                            matched_anchor_id = nullif($9, '')::uuid,
                            reason = $10,
                            inference_attempt_count = $11,
                            last_inferred_at = $12,
                            updated_at = now()
                        where job_id = $1::uuid
                          and image_id = $2::uuid
                          and user_id = $3::uuid
                          and model_version = $4
                          and preprocessing_version = $5
                          and status = 'pending'
                        """,
                        inference_params,
                    )
                if positive_params:
                    await conn.executemany(
                        """
                        insert into image_user_mappings (
                            event_id, job_id, image_id, gdrive_file_id, user_id,
                            gdrive_url, download_url, best_score, matched_face_index,
                            matched_anchor_id, model_version, preprocessing_version
                        ) values (
                            $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
                            $6, $7, $8, $9, nullif($10, '')::uuid, $11, $12
                        )
                        on conflict (job_id, image_id, user_id, model_version, preprocessing_version)
                        do update set
                            gdrive_file_id = excluded.gdrive_file_id,
                            gdrive_url = excluded.gdrive_url,
                            download_url = excluded.download_url,
                            best_score = excluded.best_score,
                            matched_face_index = excluded.matched_face_index,
                            matched_anchor_id = excluded.matched_anchor_id,
                            updated_at = now()
                        """,
                        positive_params,
                    )
        finally:
            await conn.close()

    async def _pg_finalize_job_status(self, job_id: str) -> None:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            job_row = await conn.fetchrow("select status from mirage_jobs where id = $1::uuid limit 1", job_id)
            image_rows = await conn.fetch("select status from mirage_job_images where job_id = $1::uuid", job_id)
            pair_rows = await conn.fetch(
                """
                select status
                from inference_user_image_status
                where job_id = $1::uuid
                  and model_version = $2
                  and preprocessing_version = $3
                """,
                job_id,
                self.settings.model_version,
                self.settings.preprocessing_version,
            )
            statuses = [str(row["status"] or "pending") for row in image_rows]
            pair_statuses = [str(row["status"] or "pending") for row in pair_rows]
            counts: dict[str, int] = {}
            for status_name in statuses:
                counts[status_name] = counts.get(status_name, 0) + 1
            pair_counts: dict[str, int] = {}
            for status_name in pair_statuses:
                pair_counts[status_name] = pair_counts.get(status_name, 0) + 1

            if (
                (job_row["status"] if job_row else None) == "live"
                and not any(status_name in {"pending", "processing", "rerun_requested"} for status_name in statuses)
                and pair_counts.get("pending", 0) == 0
            ):
                job_status = "live"
            elif not statuses:
                job_status = "pending"
            elif not pair_statuses and any(status_name in {"pending", "processing"} for status_name in statuses):
                job_status = "pending"
            elif pair_counts.get("pending", 0) > 0:
                job_status = "processing"
            elif any(status_name == "rerun_requested" for status_name in statuses):
                job_status = "rerun_pending"
            elif any(status_name in {"pending", "processing"} for status_name in statuses):
                job_status = "processing"
            elif any(status_name == "review_required" for status_name in statuses):
                job_status = "review"
            elif any(status_name == "failed" for status_name in statuses):
                job_status = "review"
            else:
                job_status = "review"

            stats_json = {
                "imageCount": len(statuses),
                "approvedImageCount": counts.get("approved", 0),
                "processedImageCount": counts.get("processed", 0) + counts.get("approved", 0),
                "reviewRequiredCount": counts.get("review_required", 0) + counts.get("rerun_requested", 0),
                "pendingImageCount": counts.get("pending", 0) + counts.get("processing", 0),
                "failedImageCount": counts.get("failed", 0),
                "pendingPairCount": pair_counts.get("pending", 0),
                "positivePairCount": pair_counts.get("positive", 0),
                "negativePairCount": pair_counts.get("negative", 0),
                "failedPairCount": pair_counts.get("failed", 0),
            }
            await conn.execute(
                """
                update mirage_jobs
                set status = $2,
                    stats_json = $3::jsonb,
                    updated_at = now()
                where id = $1::uuid
                """,
                job_id,
                job_status,
                json.dumps(stats_json),
            )
        finally:
            await conn.close()

    async def _pg_approve_job(self, job_id: str) -> dict[str, Any]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            job_row = await conn.fetchrow(
                "select id from mirage_jobs where id = $1::uuid limit 1",
                job_id,
            )
            if job_row is None:
                raise LookupError("Mirage job not found.")

            image_rows = await conn.fetch(
                """
                select status
                from mirage_job_images
                where job_id = $1::uuid
                """,
                job_id,
            )
            unresolved_images = [
                str(row["status"] or "pending")
                for row in image_rows
                if str(row["status"] or "pending") in {"pending", "processing", "rerun_requested"}
            ]
            if unresolved_images:
                raise ValueError("Every image must be resolved before approving the Mirage job.")

            pending_pairs = await conn.fetchval(
                """
                select count(*)::int
                from inference_user_image_status
                where job_id = $1::uuid
                  and model_version = $2
                  and preprocessing_version = $3
                  and status = 'pending'
                """,
                job_id,
                self.settings.model_version,
                self.settings.preprocessing_version,
            )
            if int(pending_pairs or 0) > 0:
                raise ValueError("Every user-image inference pair must be resolved before approving the Mirage job.")

            await conn.execute(
                """
                update mirage_job_images
                set status = 'approved',
                    updated_at = now()
                where job_id = $1::uuid
                  and status in ('processed', 'approved')
                """,
                job_id,
            )
            await conn.execute(
                """
                update mirage_jobs
                set status = 'approved',
                    batch_state = 'published',
                    approved_at = $2,
                    updated_at = now()
                where id = $1::uuid
                """,
                job_id,
                utc_now_dt(),
            )
            return {"jobId": job_id, "status": "approved"}
        finally:
            await conn.close()

    async def _pg_publish_job(self, job_id: str) -> dict[str, Any]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            job_row = await conn.fetchrow(
                "select status, gallery_visibility from mirage_jobs where id = $1::uuid limit 1",
                job_id,
            )
            if job_row is None:
                raise LookupError("Mirage job not found.")
            if str(job_row["status"] or "") != "approved":
                raise ValueError("Only approved Mirage jobs can be published.")

            await conn.execute(
                """
                update mirage_jobs
                set status = 'live',
                    gallery_visibility = 'live',
                    batch_state = 'published',
                    live_at = $2,
                    updated_at = now()
                where id = $1::uuid
                """,
                job_id,
                utc_now_dt(),
            )
            return {"jobId": job_id, "status": "live"}
        finally:
            await conn.close()

    async def _pg_unpublish_job(self, job_id: str) -> dict[str, Any]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            job_row = await conn.fetchrow(
                "select id from mirage_jobs where id = $1::uuid limit 1",
                job_id,
            )
            if job_row is None:
                raise LookupError("Mirage job not found.")

            await conn.execute(
                """
                update mirage_jobs
                set status = 'approved',
                    gallery_visibility = 'unpublished',
                    updated_at = now()
                where id = $1::uuid
                """,
                job_id,
            )
            return {"jobId": job_id, "status": "unpublished", "galleryVisibility": "unpublished"}
        finally:
            await conn.close()

    async def _pg_refresh_user_profile(self, user_id: str) -> None:
        if not self.database_url:
            return
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            profile = await conn.fetchrow(
                """
                select consent_enabled
                from mirage_user_profiles
                where user_id = $1::uuid
                limit 1
                """,
                user_id,
            )
            image_rows = await conn.fetch(
                """
                select status
                from mirage_user_images
                where user_id = $1::uuid and status <> 'deleted'
                """,
                user_id,
            )
            statuses = [str(row["status"] or "pending") for row in image_rows]
            approved_count = sum(1 for status in statuses if status == "approved")
            consent_enabled = bool(profile["consent_enabled"]) if profile else False

            if consent_enabled and approved_count >= self.settings.required_anchor_count:
                enrollment_status = "ready"
            elif any(status == "processing" for status in statuses):
                enrollment_status = "processing"
            elif statuses and approved_count < self.settings.required_anchor_count:
                enrollment_status = "needs_more_images"
            else:
                enrollment_status = "draft"

            await conn.execute(
                """
                insert into mirage_user_profiles (
                    user_id, approved_anchor_count, enrollment_status, last_processed_at
                ) values ($1::uuid, $2, $3, $4)
                on conflict (user_id) do update
                set approved_anchor_count = excluded.approved_anchor_count,
                    enrollment_status = excluded.enrollment_status,
                    last_processed_at = excluded.last_processed_at,
                    updated_at = now()
                """,
                user_id,
                approved_count,
                enrollment_status,
                utc_now_dt(),
            )
        finally:
            await conn.close()

    async def _pg_claim_pending_anchor_images(self, limit: int, user_id: str | None = None) -> list[dict[str, Any]]:
        if not self.database_url:
            return []
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            where_clause = "where status = 'pending'"
            params: list[Any] = []
            if user_id:
                where_clause += " and user_id = $1::uuid"
                params.append(user_id)
                limit_param = "$2"
            else:
                limit_param = "$1"
            params.append(limit)

            rows = await conn.fetch(
                f"""
                select id, user_id, storage_path, filename, pose_label, created_at
                from mirage_user_images
                {where_clause}
                order by created_at
                limit {limit_param}
                """,
                *params,
            )
            if not rows:
                return []

            user_ids = sorted({str(row["user_id"]) for row in rows})
            version_rows = await conn.fetch(
                """
                select user_id, last_embedding_version
                from mirage_user_profiles
                where user_id = any($1::uuid[])
                """,
                user_ids,
            )
            versions = {
                str(row["user_id"]): int(row["last_embedding_version"] or 1)
                for row in version_rows
            }

            claimed: list[dict[str, Any]] = []
            for row in rows:
                updated = await conn.fetchrow(
                    """
                    update mirage_user_images
                    set status = 'processing', updated_at = now()
                    where id = $1::uuid and status = 'pending'
                    returning id
                    """,
                    str(row["id"]),
                )
                if updated:
                    item = dict(row)
                    item["embedding_version"] = versions.get(str(row["user_id"]), 1)
                    claimed.append(item)
            return claimed
        finally:
            await conn.close()

    async def _pg_reset_retryable_anchor_images(self) -> int:
        if not self.database_url:
            return 0
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            rows = await conn.fetch(
                """
                update mirage_user_images
                set status = 'pending',
                    quality_score = null,
                    rejection_reason = null,
                    updated_at = now()
                where status = 'rejected'
                  and rejection_reason like '%found 0%'
                returning id
                """
            )
            return len(rows)
        finally:
            await conn.close()

    async def _pg_reset_processing_anchor_images(self, user_id: str | None = None) -> int:
        if not self.database_url:
            return 0
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            if user_id:
                rows = await conn.fetch(
                    """
                    update mirage_user_images
                    set status = 'pending',
                        updated_at = now()
                    where user_id = $1::uuid
                      and status = 'processing'
                    returning id
                    """,
                    user_id,
                )
            else:
                rows = await conn.fetch(
                    """
                    update mirage_user_images
                    set status = 'pending',
                        updated_at = now()
                    where status = 'processing'
                    returning id
                    """
                )
            return len(rows)
        finally:
            await conn.close()

    async def _pg_save_anchor_result(
        self,
        *,
        image_id: str,
        user_id: str,
        status: str,
        quality_score: float | None = None,
        rejection_reason: str | None = None,
        embedding: list[float] | None = None,
        embedding_version: int | None = None,
        model_name: str | None = None,
    ) -> None:
        if not self.database_url:
            return
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            await conn.execute(
                """
                update mirage_user_images
                set status = $2,
                    quality_score = $3,
                    rejection_reason = $4,
                    updated_at = now()
                where id = $1::uuid
                """,
                image_id,
                status,
                quality_score,
                rejection_reason,
            )

            if status == "approved" and embedding is not None:
                profile_row = await conn.fetchrow(
                    """
                    select last_embedding_version
                    from mirage_user_profiles
                    where user_id = $1::uuid
                    limit 1
                    """,
                    user_id,
                )
                version = embedding_version or int((profile_row["last_embedding_version"] if profile_row else 1) or 1)
                await conn.execute(
                    """
                    insert into mirage_user_embeddings (
                        user_image_id, user_id, embedding_vector, model_name, model_version,
                        preprocessing_version, embedding_version, quality_score
                    ) values ($1::uuid, $2::uuid, $3::jsonb, $4, $5, $6, $7, $8)
                    on conflict (user_image_id, embedding_version, model_version, preprocessing_version)
                    do update set
                        embedding_vector = excluded.embedding_vector,
                        model_name = excluded.model_name,
                        quality_score = excluded.quality_score,
                        updated_at = now()
                    """,
                    image_id,
                    user_id,
                    json.dumps(embedding),
                    model_name or self.settings.insightface_model,
                    self.settings.model_version,
                    self.settings.preprocessing_version,
                    version,
                    quality_score,
                )
            else:
                await conn.execute(
                    "delete from mirage_user_embeddings where user_image_id = $1::uuid",
                    image_id,
                )
        finally:
            await conn.close()

        await self._pg_refresh_user_profile(user_id)

    def _s3_client(self):
        endpoint_url = self.settings.mirage_s3_endpoint_url or (
            f"https://s3.{self.settings.mirage_s3_region}.amazonaws.com"
        )
        return boto3.client(
            "s3",
            region_name=self.settings.mirage_s3_region,
            endpoint_url=endpoint_url,
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
            aws_session_token=self.settings.aws_session_token,
            config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    def is_available(self) -> bool:
        if self.database_url:
            with self._timed("db.is_available"):
                return bool(self._run_pg(self._pg_is_available()))
        if self.client is None:
            return False
        response = self.client.table("mirage_jobs").select("id").limit(1).execute()
        _ = response.data
        return True

    def upsert_event(
        self,
        slug: str,
        name: str | None = None,
        drive_folder_url: str | None = None,
    ) -> dict[str, Any]:
        event_name = name or slug.replace("-", " ").title()
        row: dict[str, Any] = {
            "slug": slug,
            "name": event_name,
            "normalized_name": normalize_identifier(event_name),
            "is_published": True,
            "updated_at": utc_now(),
        }
        if drive_folder_url is not None:
            row["drive_folder_url"] = drive_folder_url.strip() or None
        response = self.client.table("events").upsert(row, on_conflict="slug").execute()
        return response.data[0]

    def get_event(self, slug: str) -> dict[str, Any]:
        response = (
            self.client.table("events")
            .select("id, slug, name")
            .eq("slug", slug)
            .single()
            .execute()
        )
        return response.data

    def upsert_person(self, row: dict[str, str]) -> dict[str, Any]:
        display_name = row["display_name"].strip()
        alias = (row.get("alias") or "").strip() or None
        response = (
            self.client.table("people")
            .upsert(
                {
                    "display_name": display_name,
                    "normalized_name": normalize_identifier(display_name),
                    "alias": alias,
                    "normalized_alias": normalize_identifier(alias) if alias else None,
                    "is_published": True,
                    "updated_at": utc_now(),
                },
                on_conflict="normalized_name",
            )
            .execute()
        )
        return response.data[0]

    def unpublish_person(self, person_id: str) -> None:
        (
            self.client.table("people")
            .update({"is_published": False, "updated_at": utc_now()})
            .eq("id", person_id)
            .execute()
        )

    def find_person_by_name(self, display_name: str) -> dict[str, Any] | None:
        response = (
            self.client.table("people")
            .select("id, display_name")
            .eq("normalized_name", normalize_identifier(display_name))
            .maybe_single()
            .execute()
        )
        return response.data

    def upsert_photo(
        self,
        external_photo_id: str,
        public_url: str,
        storage_path: str | None = None,
        caption: str | None = None,
        drive_file_id: str | None = None,
    ) -> dict[str, Any]:
        row: dict[str, Any] = {
            "external_photo_id": external_photo_id,
            "storage_path": storage_path,
            "public_url": public_url,
            "caption": caption,
            "moderation_status": "approved",
            "is_published": True,
            "updated_at": utc_now(),
        }
        if drive_file_id is not None:
            row["drive_file_id"] = drive_file_id
        response = (
            self.client.table("photos")
            .upsert(row, on_conflict="external_photo_id")
            .execute()
        )
        return response.data[0]

    def link_photo_to_event(
        self,
        event_id: str,
        photo_id: str,
        sort_order: int = 0,
        is_featured: bool = False,
    ) -> None:
        (
            self.client.table("event_photos")
            .upsert(
                {
                    "event_id": event_id,
                    "photo_id": photo_id,
                    "sort_order": sort_order,
                    "is_featured": is_featured,
                },
                on_conflict="event_id,photo_id",
            )
            .execute()
        )

    def upsert_person_photo_match(
        self,
        person_id: str,
        photo_id: str,
        confidence: float,
        bbox: dict[str, float],
    ) -> None:
        (
            self.client.table("photo_people")
            .upsert(
                {
                    "person_id": person_id,
                    "photo_id": photo_id,
                    "confidence": confidence,
                    "bbox": bbox,
                    "source": "local_face_pipeline",
                    "review_status": "approved",
                    "updated_at": utc_now(),
                },
                on_conflict="person_id,photo_id",
            )
            .execute()
        )

    @staticmethod
    def _first(data: list[dict[str, Any]] | None) -> dict[str, Any] | None:
        if not data:
            return None
        return data[0]

    def _profile_for_user(self, user_id: str) -> dict[str, Any] | None:
        if self.database_url:
            row = self._run_pg(self._pg_profile_for_user(user_id))
            if row is not None:
                return row
        response = (
            self.client.table("mirage_user_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return self._first(response.data)

    def _refresh_user_profile(self, user_id: str) -> None:
        if self.database_url:
            self._run_pg(self._pg_refresh_user_profile(user_id))
            return
        profile = self._profile_for_user(user_id) or {}
        response = (
            self.client.table("mirage_user_images")
            .select("status")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .execute()
        )
        statuses = [str(row.get("status") or "pending") for row in (response.data or [])]
        approved_count = sum(1 for status in statuses if status == "approved")
        consent_enabled = bool(profile.get("consent_enabled", False))

        if consent_enabled and approved_count >= self.settings.required_anchor_count:
            enrollment_status = "ready"
        elif any(status == "processing" for status in statuses):
            enrollment_status = "processing"
        elif statuses and approved_count < self.settings.required_anchor_count:
            enrollment_status = "needs_more_images"
        else:
            enrollment_status = "draft"

        (
            self.client.table("mirage_user_profiles")
            .upsert(
                {
                    "user_id": user_id,
                    "approved_anchor_count": approved_count,
                    "enrollment_status": enrollment_status,
                    "last_processed_at": utc_now(),
                },
                on_conflict="user_id",
            )
            .execute()
        )

    def claim_pending_anchor_images(self, limit: int, user_id: str | None = None) -> list[dict[str, Any]]:
        if self.database_url:
            with self._timed("db.claim_pending_anchor_images", limit=limit, userId=user_id):
                return self._run_pg(self._pg_claim_pending_anchor_images(limit, user_id))
        query = (
            self.client.table("mirage_user_images")
            .select("id, user_id, storage_path, filename, pose_label, created_at")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
        )
        if user_id:
            query = query.eq("user_id", user_id)
        response = query.execute()
        rows = list(response.data or [])
        if not rows:
            return []

        user_ids = sorted({str(row["user_id"]) for row in rows})
        profiles_response = (
            self.client.table("mirage_user_profiles")
            .select("user_id, last_embedding_version")
            .in_("user_id", user_ids)
            .execute()
        )
        versions = {
            str(row["user_id"]): int(row.get("last_embedding_version") or 1)
            for row in (profiles_response.data or [])
        }

        claimed: list[dict[str, Any]] = []
        for row in rows:
            image_id = str(row["id"])
            updated = (
                self.client.table("mirage_user_images")
                .update({"status": "processing"})
                .eq("id", image_id)
                .eq("status", "pending")
                .execute()
            )
            if updated.data:
                row["embedding_version"] = versions.get(str(row["user_id"]), 1)
                claimed.append(row)
        return claimed

    def reset_retryable_anchor_images(self) -> int:
        if self.database_url:
            with self._timed("db.reset_retryable_anchor_images"):
                return self._run_pg(self._pg_reset_retryable_anchor_images())
        response = (
            self.client.table("mirage_user_images")
            .update(
                {
                    "status": "pending",
                    "quality_score": None,
                    "rejection_reason": None,
                }
            )
            .eq("status", "rejected")
            .like("rejection_reason", "%found 0%")
            .execute()
        )
        return len(response.data or [])

    def reset_processing_anchor_images(self, user_id: str | None = None) -> int:
        if self.database_url:
            with self._timed("db.reset_processing_anchor_images", userId=user_id):
                return self._run_pg(self._pg_reset_processing_anchor_images(user_id))

        query = (
            self.client.table("mirage_user_images")
            .update({"status": "pending"})
            .eq("status", "processing")
        )
        if user_id:
            query = query.eq("user_id", user_id)
        response = query.execute()
        return len(response.data or [])

    def download_anchor_image(self, row: dict[str, Any]) -> Path:
        image_id = row.get("id")
        user_id = row.get("user_id")
        with self._timed("db.download_anchor_image", imageId=image_id, userId=user_id):
            storage_path = row.get("storage_path")
            if not storage_path:
                raise RuntimeError("Anchor image has no storage path.")
            local_dir = self.settings.data_dir / "anchors" / str(row["user_id"])
            local_dir.mkdir(parents=True, exist_ok=True)
            local_path = local_dir / Path(str(row.get("filename") or row["id"])).name
            if not local_path.exists():
                if self.settings.aws_access_key_id and self.settings.aws_secret_access_key:
                    self._s3_client().download_file(
                        self.settings.mirage_s3_bucket_name,
                        str(storage_path),
                        str(local_path),
                    )
                elif self.settings.mirage_s3_public_base_url:
                    base = self.settings.mirage_s3_public_base_url.rstrip("/")
                    quoted_path = quote(str(storage_path).lstrip("/"), safe="/")
                    with urlopen(f"{base}/{quoted_path}") as response:
                        local_path.write_bytes(response.read())
                else:
                    raise RuntimeError(
                        "Anchor download needs AWS credentials or MIRAGE_S3_PUBLIC_BASE_URL."
                    )
            return local_path

    def save_anchor_result(
        self,
        *,
        image_id: str,
        user_id: str,
        status: str,
        quality_score: float | None = None,
        rejection_reason: str | None = None,
        embedding: list[float] | None = None,
        embedding_version: int | None = None,
        model_name: str | None = None,
    ) -> None:
        if self.database_url:
            with self._timed("db.save_anchor_result", imageId=image_id, userId=user_id, status=status):
                self._run_pg(
                    self._pg_save_anchor_result(
                        image_id=image_id,
                        user_id=user_id,
                        status=status,
                        quality_score=quality_score,
                        rejection_reason=rejection_reason,
                        embedding=embedding,
                        embedding_version=embedding_version,
                        model_name=model_name,
                    )
                )
                return
        (
            self.client.table("mirage_user_images")
            .update(
                {
                    "status": status,
                    "quality_score": quality_score,
                    "rejection_reason": rejection_reason,
                }
            )
            .eq("id", image_id)
            .execute()
        )

        if status == "approved" and embedding is not None:
            version = embedding_version or int(
                (self._profile_for_user(user_id) or {}).get("last_embedding_version") or 1
            )
            (
                self.client.table("mirage_user_embeddings")
                .upsert(
                    {
                        "user_image_id": image_id,
                        "user_id": user_id,
                        "embedding_vector": embedding,
                        "model_name": model_name or self.settings.insightface_model,
                        "model_version": self.settings.model_version,
                        "preprocessing_version": self.settings.preprocessing_version,
                        "embedding_version": version,
                        "quality_score": quality_score,
                    },
                    on_conflict="user_image_id,embedding_version,model_version,preprocessing_version",
                )
                .execute()
            )
        else:
            (
                self.client.table("mirage_user_embeddings")
                .delete()
                .eq("user_image_id", image_id)
                .execute()
            )

        self._refresh_user_profile(user_id)

    def get_embedding_snapshot_token(self) -> str:
        if self.database_url:
            with self._timed("db.get_embedding_snapshot_token"):
                return self._run_pg(self._pg_get_embedding_snapshot_token())
        response = (
            self.client.table("mirage_user_profiles")
            .select("user_id, last_embedding_version, updated_at, approved_anchor_count, consent_enabled")
            .order("user_id")
            .execute()
        )
        payload = json.dumps(response.data or [], sort_keys=True, default=str)
        return sha256(payload.encode("utf-8")).hexdigest()

    def get_approved_user_embeddings(self) -> list[dict[str, Any]]:
        if self.database_url:
            with self._timed("db.get_approved_user_embeddings"):
                return self._run_pg(self._pg_get_approved_user_embeddings())
        profiles_response = (
            self.client.table("mirage_user_profiles")
            .select("user_id, consent_enabled, approved_anchor_count")
            .eq("consent_enabled", True)
            .gte("approved_anchor_count", self.settings.required_anchor_count)
            .execute()
        )
        ready_user_ids = [str(row["user_id"]) for row in (profiles_response.data or [])]
        if not ready_user_ids:
            return []

        embeddings_response = (
            self.client.table("mirage_user_embeddings")
            .select("id, user_id, user_image_id, embedding_vector, quality_score, model_name, model_version, preprocessing_version, embedding_version")
            .in_("user_id", ready_user_ids)
            .eq("model_version", self.settings.model_version)
            .eq("preprocessing_version", self.settings.preprocessing_version)
            .execute()
        )
        user_response = (
            self.client.table("users")
            .select("id, name")
            .in_("id", ready_user_ids)
            .execute()
        )
        names = {str(row["id"]): row.get("name") for row in (user_response.data or [])}
        results: list[dict[str, Any]] = []
        for row in embeddings_response.data or []:
            results.append(
                {
                    **row,
                    "user_id": str(row["user_id"]),
                    "display_name": names.get(str(row["user_id"])) or "Unknown user",
                }
            )
        return results

    def initialize_inference_state(self, job: dict[str, Any], store: Any) -> dict[str, int]:
        if self.database_url:
            with self._timed("db.initialize_inference_state", jobId=job.get("id")):
                return self._run_pg(self._pg_initialize_inference_state(job, store))
        job_id = str(job["id"])
        event_id = job.get("event_id")
        force_recheck = bool(job.get("force_recheck", False))
        user_ids = sorted({str(label["user_id"]) for label in getattr(store, "user_labels", [])})
        image_response = (
            self.client.table("mirage_job_images")
            .select("id, drive_file_id")
            .eq("job_id", job_id)
            .order("display_order")
            .execute()
        )
        images = list(image_response.data or [])
        inserted = 0
        for image in images:
            for user_id in user_ids:
                response = (
                    self.client.table("inference_user_image_status")
                    .upsert(
                        {
                            "event_id": event_id,
                            "job_id": job_id,
                            "image_id": str(image["id"]),
                            "gdrive_file_id": image.get("drive_file_id"),
                            "user_id": user_id,
                            "status": "pending",
                            "model_version": self.settings.model_version,
                            "preprocessing_version": self.settings.preprocessing_version,
                        },
                        on_conflict="job_id,image_id,user_id,model_version,preprocessing_version",
                        ignore_duplicates=True,
                    )
                    .execute()
                )
                if response.data:
                    inserted += 1

        reset = 0
        if force_recheck:
            response = (
                self.client.table("inference_user_image_status")
                .update(
                    {
                        "status": "pending",
                        "best_score": None,
                        "matched_face_index": None,
                        "matched_anchor_id": None,
                        "reason": "force_recheck",
                        "last_inferred_at": None,
                    }
                )
                .eq("job_id", job_id)
                .eq("model_version", self.settings.model_version)
                .eq("preprocessing_version", self.settings.preprocessing_version)
                .in_("status", ["positive", "negative", "failed"])
                .execute()
            )
            reset = len(response.data or [])
        return {"images": len(images), "users": len(user_ids), "inserted": inserted, "reset": reset}

    def claim_next_job(self) -> dict[str, Any] | None:
        if self.database_url:
            # Targeted starts are the primary flow; background polling can be
            # added later for direct Postgres if needed.
            return None
        response = (
            self.client.table("mirage_jobs")
            .select("*")
            .in_("status", ["pending", "rerun_pending"])
            .order("created_at")
            .limit(1)
            .execute()
        )
        row = self._first(response.data)
        if row is None:
            pending_response = (
                self.client.table("inference_user_image_status")
                .select("job_id")
                .eq("status", "pending")
                .eq("model_version", self.settings.model_version)
                .eq("preprocessing_version", self.settings.preprocessing_version)
                .limit(1)
                .execute()
            )
            pending_row = self._first(pending_response.data)
            if pending_row is not None:
                job_response = (
                    self.client.table("mirage_jobs")
                    .select("*")
                    .eq("id", pending_row["job_id"])
                    .limit(1)
                    .execute()
                )
                row = self._first(job_response.data)
        if row is None:
            return None
        patch = {"claimed_by": self.worker_id, "claimed_at": utc_now()}
        if row.get("status") in {"pending", "rerun_pending"}:
            patch["status"] = "processing"
        updated = self.client.table("mirage_jobs").update(patch).eq("id", row["id"]).execute()
        return self._first(updated.data) or {**row, **patch}

    def claim_job_by_id(self, job_id: str) -> dict[str, Any] | None:
        if self.database_url:
            with self._timed("db.claim_job_by_id", jobId=job_id):
                return self._run_pg(self._pg_claim_job_by_id(job_id))
        response = (
            self.client.table("mirage_jobs")
            .select("*")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        row = self._first(response.data)
        if row is None:
            return None

        patch = {"claimed_by": self.worker_id, "claimed_at": utc_now()}
        if row.get("status") in {"pending", "rerun_pending"}:
            patch["status"] = "processing"
        updated = self.client.table("mirage_jobs").update(patch).eq("id", row["id"]).execute()
        return self._first(updated.data) or {**row, **patch}

    def claim_job_images(self, job_id: str, batch_size: int) -> list[dict[str, Any]]:
        if self.database_url:
            with self._timed("db.claim_job_images", jobId=job_id, batchSize=batch_size):
                return self._run_pg(self._pg_claim_job_images(job_id, batch_size))
        pending_response = (
            self.client.table("inference_user_image_status")
            .select("image_id")
            .eq("job_id", job_id)
            .eq("status", "pending")
            .eq("model_version", self.settings.model_version)
            .eq("preprocessing_version", self.settings.preprocessing_version)
            .limit(batch_size * 20)
            .execute()
        )
        pending_image_ids: list[str] = []
        for item in pending_response.data or []:
            image_id = str(item["image_id"])
            if image_id not in pending_image_ids:
                pending_image_ids.append(image_id)
            if len(pending_image_ids) >= batch_size:
                break
        if not pending_image_ids:
            return []
        response = (
            self.client.table("mirage_job_images")
            .select("*")
            .in_("id", pending_image_ids)
            .order("display_order")
            .execute()
        )
        return list(response.data or [])

    def get_pending_users_for_image(self, job_id: str, image_id: str) -> list[dict[str, Any]]:
        if self.database_url:
            with self._timed("db.get_pending_users_for_image", jobId=job_id, imageId=image_id):
                return self._run_pg(self._pg_get_pending_users_for_image(job_id, image_id))
        response = (
            self.client.table("inference_user_image_status")
            .select("id, user_id")
            .eq("job_id", job_id)
            .eq("image_id", image_id)
            .eq("status", "pending")
            .eq("model_version", self.settings.model_version)
            .eq("preprocessing_version", self.settings.preprocessing_version)
            .execute()
        )
        return list(response.data or [])

    def download_job_source_image(self, row: dict[str, Any]) -> Path:
        with self._timed("db.download_job_source_image", jobId=row.get("job_id"), imageId=row.get("id"), driveFileId=row.get("drive_file_id")):
            drive_file_id = row.get("drive_file_id")
            if not drive_file_id:
                raise RuntimeError("Job image has no drive file id.")

            suffix = Path(str(row.get("filename") or "")).suffix or ".jpg"
            cache_dir = self.settings.data_dir / "jobs" / str(row["job_id"]) / "originals"
            cache_dir.mkdir(parents=True, exist_ok=True)
            local_path = cache_dir / f"{drive_file_id}{suffix}"
            if not local_path.exists():
                tmp_path = download_drive_file_to_temp(
                    self.settings.google_application_credentials,
                    drive_file_id,
                    suffix=suffix,
                )
                local_path.write_bytes(tmp_path.read_bytes())
                tmp_path.unlink(missing_ok=True)
            return local_path

    def _download_url_to_path(self, url: str, target_path: Path) -> Path:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(url) as response:
            target_path.write_bytes(response.read())
        return target_path

    def download_job_image(self, row: dict[str, Any]) -> Path:
        with self._timed("db.download_job_image", jobId=row.get("job_id"), imageId=row.get("id")):
            inference_local_path = row.get("inference_local_path")
            if inference_local_path:
                local_path = Path(str(inference_local_path))
                if local_path.exists():
                    return local_path

            return self.download_job_source_image(row)

    def get_job_asset_counts(self, job_id: str) -> dict[str, int]:
        if not self.database_url:
            return {"total": 0, "ready": 0, "failed": 0}
        with self._timed("db.get_job_asset_counts", jobId=job_id):
            return self._run_pg(self._pg_get_job_asset_counts(job_id))

    def get_job_asset_cleanup_plan(self, job_id: str) -> dict[str, Any]:
        if not self.database_url:
            raise LookupError("Mirage job not found.")
        with self._timed("db.get_job_asset_cleanup_plan", jobId=job_id):
            return self._run_pg(self._pg_get_job_asset_cleanup_plan(job_id))

    def execute_job_asset_cleanup(self, plan: dict[str, Any]) -> dict[str, Any]:
        with self._timed("db.execute_job_asset_cleanup", jobId=plan.get("jobId")):
            object_keys = [str(item) for item in (plan.get("objectKeys") or []) if item]
            deleted_s3_count = 0
            if object_keys:
                client = self._s3_client()
                for start in range(0, len(object_keys), 1000):
                    chunk = object_keys[start:start + 1000]
                    client.delete_objects(
                        Bucket=self.settings.mirage_s3_bucket_name,
                        Delete={"Objects": [{"Key": key} for key in chunk], "Quiet": True},
                    )
                    deleted_s3_count += len(chunk)

            job_id = str(plan.get("jobId") or "")
            removed_local_dirs = 0
            for root in (
                self.settings.data_dir / "job-assets" / job_id,
                self.settings.data_dir / "jobs" / job_id,
            ):
                if root.exists():
                    shutil.rmtree(root, ignore_errors=True)
                    removed_local_dirs += 1

            return {
                "deletedS3ObjectCount": deleted_s3_count,
                "removedLocalDirectoryCount": removed_local_dirs,
            }

    def save_user_image_inference_result(
        self,
        *,
        job: dict[str, Any],
        image: dict[str, Any],
        user_id: str,
        status: str,
        best_score: float | None = None,
        matched_face_index: int | None = None,
        matched_anchor_id: str | None = None,
        reason: str | None = None,
    ) -> None:
        if self.database_url:
            with self._timed("db.save_user_image_inference_result", jobId=job.get("id"), imageId=image.get("id"), userId=user_id, status=status):
                self._run_pg(
                    self._pg_save_user_image_inference_result(
                        job=job,
                        image=image,
                        user_id=user_id,
                        status=status,
                        best_score=best_score,
                        matched_face_index=matched_face_index,
                        matched_anchor_id=matched_anchor_id,
                        reason=reason,
                    )
                )
                return
        job_id = str(job["id"])
        image_id = str(image["id"])
        existing_response = (
            self.client.table("inference_user_image_status")
            .select("inference_attempt_count")
            .eq("job_id", job_id)
            .eq("image_id", image_id)
            .eq("user_id", user_id)
            .eq("model_version", self.settings.model_version)
            .eq("preprocessing_version", self.settings.preprocessing_version)
            .limit(1)
            .execute()
        )
        existing = self._first(existing_response.data) or {}
        payload = {
            "status": status,
            "best_score": best_score,
            "matched_face_index": matched_face_index,
            "matched_anchor_id": matched_anchor_id or None,
            "reason": reason,
            "model_version": self.settings.model_version,
            "preprocessing_version": self.settings.preprocessing_version,
            "inference_attempt_count": int(existing.get("inference_attempt_count") or 0) + 1,
            "last_inferred_at": utc_now(),
        }
        (
            self.client.table("inference_user_image_status")
            .update(payload)
            .eq("job_id", job_id)
            .eq("image_id", image_id)
            .eq("user_id", user_id)
            .eq("model_version", self.settings.model_version)
            .eq("preprocessing_version", self.settings.preprocessing_version)
            .eq("status", "pending")
            .execute()
        )
        if status == "positive":
            drive_file_id = image.get("drive_file_id") or ""
            (
                self.client.table("image_user_mappings")
                .upsert(
                    {
                        "event_id": job.get("event_id"),
                        "job_id": job_id,
                        "image_id": image_id,
                        "gdrive_file_id": drive_file_id,
                        "user_id": user_id,
                        "gdrive_url": image.get("gdrive_url") or drive_file_view_url(drive_file_id),
                        "download_url": image.get("download_url") or public_drive_file_url(drive_file_id),
                        "best_score": best_score,
                        "matched_face_index": matched_face_index,
                        "matched_anchor_id": matched_anchor_id or None,
                        "model_version": self.settings.model_version,
                        "preprocessing_version": self.settings.preprocessing_version,
                    },
                    on_conflict="job_id,image_id,user_id,model_version,preprocessing_version",
                )
                .execute()
            )

    def save_job_batch_results(
        self,
        *,
        job: dict[str, Any],
        rows: list[dict[str, Any]],
        analyzed: list[dict[str, Any]],
    ) -> None:
        if self.database_url:
            with self._timed("db.save_job_batch_results", jobId=job.get("id"), imageCount=len(rows), analyzedCount=len(analyzed)):
                self._run_pg(
                    self._pg_save_job_batch_results(
                        job=job,
                        rows=rows,
                        analyzed=analyzed,
                    )
                )
                return
        for row, outcome in zip(rows, analyzed, strict=True):
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

    def save_job_image_result(
        self,
        *,
        job_image_id: str,
        status: str,
        sha256_value: str | None = None,
        faces: list[dict[str, Any]] | None = None,
        last_error: str | None = None,
    ) -> None:
        if self.database_url:
            with self._timed("db.save_job_image_result", jobImageId=job_image_id, status=status):
                self._run_pg(
                    self._pg_save_job_image_result(
                        job_image_id=job_image_id,
                        status=status,
                        sha256_value=sha256_value,
                        faces=faces,
                        last_error=last_error,
                    )
                )
                return
        faces = faces or []
        image_response = (
            self.client.table("mirage_job_images")
            .select("job_id, status")
            .eq("id", job_image_id)
            .limit(1)
            .execute()
        )
        image_row = self._first(image_response.data)
        if image_row is None:
            return
        current_status = str(image_row.get("status") or "pending")
        next_status = current_status if current_status == "approved" and status in {"processed", "failed"} else status

        (
            self.client.table("mirage_job_images")
            .update(
                {
                    "status": next_status,
                    "sha256": sha256_value,
                    "last_error": last_error,
                    "download_status": "downloaded" if last_error is None else "failed",
                    "face_detection_status": "completed" if last_error is None else "failed",
                    "detected_face_count": len(faces),
                }
            )
            .eq("id", job_image_id)
            .execute()
        )
        face_rows = (
            self.client.table("mirage_detected_faces")
            .select("id")
            .eq("job_image_id", job_image_id)
            .execute()
        )
        existing_face_ids = [str(row["id"]) for row in (face_rows.data or [])]
        if existing_face_ids:
            (
                self.client.table("mirage_face_matches")
                .delete()
                .in_("face_id", existing_face_ids)
                .execute()
            )
        (
            self.client.table("mirage_detected_faces")
            .delete()
            .eq("job_image_id", job_image_id)
            .execute()
        )

        for face in faces:
            face_insert = (
                self.client.table("mirage_detected_faces")
                .insert(
                    {
                        "job_image_id": job_image_id,
                        "bbox": face.get("bbox") or {},
                        "landmarks": face.get("landmarks") or [],
                        "detection_score": face.get("detection_score"),
                        "quality_score": face.get("quality_score"),
                        "crop_path": face.get("crop_path"),
                        "status": face.get("status") or "unknown",
                    }
                )
                .execute()
            )
            face_row = self._first(face_insert.data)
            if face_row is None:
                continue
            match = face.get("match")
            if not match:
                continue
            (
                self.client.table("mirage_face_matches")
                .insert(
                    {
                        "face_id": face_row["id"],
                        "user_id": match.get("user_id"),
                        "best_score": match.get("best_score"),
                        "second_best_score": match.get("second_best_score"),
                        "margin": match.get("margin"),
                        "auto_decision": match.get("auto_decision"),
                    }
                )
                .execute()
            )

        self.finalize_job_status(str(image_row["job_id"]))

    def finalize_job_status(self, job_id: str) -> None:
        if self.database_url:
            with self._timed("db.finalize_job_status", jobId=job_id):
                self._run_pg(self._pg_finalize_job_status(job_id))
                return
        job_response = (
            self.client.table("mirage_jobs")
            .select("status")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        job_row = self._first(job_response.data) or {}
        response = (
            self.client.table("mirage_job_images")
            .select("status")
            .eq("job_id", job_id)
            .execute()
        )
        pair_response = (
            self.client.table("inference_user_image_status")
            .select("status")
            .eq("job_id", job_id)
            .eq("model_version", self.settings.model_version)
            .eq("preprocessing_version", self.settings.preprocessing_version)
            .execute()
        )
        statuses = [str(row.get("status") or "pending") for row in (response.data or [])]
        pair_statuses = [str(row.get("status") or "pending") for row in (pair_response.data or [])]
        counts: dict[str, int] = {}
        for status_name in statuses:
            counts[status_name] = counts.get(status_name, 0) + 1
        pair_counts: dict[str, int] = {}
        for status_name in pair_statuses:
            pair_counts[status_name] = pair_counts.get(status_name, 0) + 1

        if (
            job_row.get("status") == "live"
            and not any(status_name in {"pending", "processing", "rerun_requested"} for status_name in statuses)
            and pair_counts.get("pending", 0) == 0
        ):
            job_status = "live"
        elif not statuses:
            job_status = "pending"
        elif not pair_statuses and any(status_name in {"pending", "processing"} for status_name in statuses):
            job_status = "pending"
        elif pair_counts.get("pending", 0) > 0:
            job_status = "processing"
        elif any(status_name == "rerun_requested" for status_name in statuses):
            job_status = "rerun_pending"
        elif any(status_name in {"pending", "processing"} for status_name in statuses):
            job_status = "processing"
        elif any(status_name == "review_required" for status_name in statuses):
            job_status = "review"
        elif any(status_name == "failed" for status_name in statuses):
            job_status = "review"
        else:
            job_status = "review"

        stats_json = {
            "imageCount": len(statuses),
            "approvedImageCount": counts.get("approved", 0),
            "processedImageCount": counts.get("processed", 0) + counts.get("approved", 0),
            "reviewRequiredCount": counts.get("review_required", 0) + counts.get("rerun_requested", 0),
            "pendingImageCount": counts.get("pending", 0) + counts.get("processing", 0),
            "failedImageCount": counts.get("failed", 0),
            "pendingPairCount": pair_counts.get("pending", 0),
            "positivePairCount": pair_counts.get("positive", 0),
            "negativePairCount": pair_counts.get("negative", 0),
            "failedPairCount": pair_counts.get("failed", 0),
        }

        (
            self.client.table("mirage_jobs")
            .update(
                {
                    "status": job_status,
                    "stats_json": stats_json,
                }
            )
            .eq("id", job_id)
            .execute()
        )

    def approve_job(self, job_id: str) -> dict[str, Any]:
        if not self.database_url:
            raise RuntimeError("Mirage database is not configured yet.")
        with self._timed("db.approve_job", jobId=job_id):
            return self._run_pg(self._pg_approve_job(job_id))

    def publish_job(self, job_id: str) -> dict[str, Any]:
        if not self.database_url:
            raise RuntimeError("Mirage database is not configured yet.")
        with self._timed("db.publish_job", jobId=job_id):
            return self._run_pg(self._pg_publish_job(job_id))

    def unpublish_job(self, job_id: str) -> dict[str, Any]:
        if not self.database_url:
            raise RuntimeError("Mirage database is not configured yet.")
        with self._timed("db.unpublish_job", jobId=job_id):
            return self._run_pg(self._pg_unpublish_job(job_id))
