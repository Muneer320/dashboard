from __future__ import annotations

import asyncio
import json
import mimetypes
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from typing import Any, Iterator

import asyncpg
import boto3
from botocore.config import Config as BotoConfig
from PIL import Image, ImageOps, ImageSequence, UnidentifiedImageError

try:
    from pillow_heif import register_heif_opener
except Exception:  # pragma: no cover
    register_heif_opener = None

try:
    import rawpy
except Exception:  # pragma: no cover
    rawpy = None

if register_heif_opener is not None:  # pragma: no branch
    register_heif_opener()

RAW_EXTENSIONS = {".nef", ".cr2", ".cr3", ".arw", ".dng", ".rw2", ".orf", ".raf"}
ASSET_ACTIVE_STATUSES = ("pending", "downloading", "optimizing", "uploading")


def _largest_tiff_frame(image: Image.Image) -> Image.Image:
    largest = image
    largest_area = image.width * image.height
    try:
        for frame in ImageSequence.Iterator(image):
            area = int(frame.width) * int(frame.height)
            if area > largest_area:
                largest = frame.copy()
                largest_area = area
    except Exception:
        return image.copy()
    return largest if largest is not image else image.copy()


@dataclass(frozen=True)
class AssetResult:
    job_image_id: str
    asset_status: str
    asset_error: str | None
    source_mime_type: str | None
    source_extension: str | None
    optimized_format: str | None
    thumb_storage_key: str | None
    thumb_public_url: str | None
    preview_storage_key: str | None
    preview_public_url: str | None
    inference_storage_key: str | None
    inference_public_url: str | None
    inference_local_path: str | None
    optimized_width: int | None
    optimized_height: int | None
    optimized_sha256: str | None
    skipped: bool = False


class JobAssetOptimizer:
    def __init__(self, *, settings: Any, db: Any, progress_callback: Any | None = None, telemetry: Any | None = None) -> None:
        self.settings = settings
        self.db = db
        self.progress_callback = progress_callback
        self.telemetry = telemetry

    @contextmanager
    def _timed(self, name: str, **fields: Any) -> Iterator[None]:
        if self.telemetry is None:
            yield
            return
        with self.telemetry.span(name, component="asset-optimizer", **fields):
            yield

    @property
    def database_url(self) -> str:
        if not self.db.database_url:
            raise RuntimeError("Mirage database is not configured yet.")
        return str(self.db.database_url)

    @property
    def job_asset_root(self) -> Path:
        return self.settings.data_dir / "job-assets"

    def run(self, job_id: str, *, batch_size: int, retry_failed_only: bool = False) -> dict[str, Any]:
        with self._timed("assets.run", jobId=job_id, batchSize=batch_size, retryFailedOnly=retry_failed_only):
            self._run(self._ensure_asset_schema())
            job = self._run(self._fetch_job(job_id))
            if job is None:
                raise LookupError("Mirage job not found.")

            self._run(self._set_job_asset_state(job_id, "discovering"))
            rehydrated = self._rehydrate_local_inference_cache(job_id)

            totals = {"processed": 0, "optimized": 0, "uploaded": 0, "failed": 0, "skipped": 0, "rehydrated": rehydrated}
            rows = self._run(self._claim_job_asset_images(job_id, batch_size=None, retry_failed_only=retry_failed_only))
            if rows:
                self._run(self._set_job_asset_state(job_id, "downloading"))
                sources = self._download_sources(job_id, rows)
                self._run(self._set_job_asset_state(job_id, "optimizing"))
                optimized = self._optimize_variants(job_id, rows, sources)
                self._run(self._set_job_asset_state(job_id, "uploading"))
                results = self._upload_variants(job_id, rows, optimized)
                self._run(self._save_asset_results(job_id, results))

                for result in results:
                    totals["processed"] += 1
                    if result.skipped:
                        totals["skipped"] += 1
                    elif result.asset_status == "ready":
                        totals["optimized"] += 1
                        totals["uploaded"] += 1
                    else:
                        totals["failed"] += 1

            summary = self._run(self._refresh_job_asset_state(job_id))
            self._write_manifest(job_id)
            return {"jobId": job_id, **totals, **summary}

    def _emit_progress(self, *, stage: str, current: int, total: int, message: str) -> None:
        if self.progress_callback is None:
            return
        safe_total = max(int(total), 1)
        safe_current = max(0, min(int(current), safe_total))
        self.progress_callback(
            {
                "stage": stage,
                "label": stage.replace("-", " "),
                "current": safe_current,
                "total": safe_total,
                "percent": round((safe_current / safe_total) * 100),
            },
            message,
        )

    def _run(self, coroutine):
        return asyncio.run(coroutine)

    async def _fetch_job(self, job_id: str) -> dict[str, Any] | None:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            row = await conn.fetchrow("select * from mirage_jobs where id = $1::uuid limit 1", job_id)
            return dict(row) if row else None
        finally:
            await conn.close()

    async def _ensure_asset_schema(self) -> None:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            statements = [
                """
                alter table mirage_jobs
                add column if not exists asset_state text not null default 'idle'
                """,
                """
                alter table mirage_jobs
                add column if not exists asset_stats_json jsonb not null default '{}'::jsonb
                """,
                """
                alter table mirage_job_images
                add column if not exists asset_status text not null default 'pending'
                """,
                "alter table mirage_job_images add column if not exists asset_error text",
                """
                alter table mirage_job_images
                add column if not exists asset_attempt_count integer not null default 0
                """,
                "alter table mirage_job_images add column if not exists asset_optimized_at timestamptz",
                "alter table mirage_job_images add column if not exists source_mime_type text",
                "alter table mirage_job_images add column if not exists source_extension text",
                "alter table mirage_job_images add column if not exists optimized_format text",
                "alter table mirage_job_images add column if not exists thumb_storage_key text",
                "alter table mirage_job_images add column if not exists thumb_public_url text",
                "alter table mirage_job_images add column if not exists preview_storage_key text",
                "alter table mirage_job_images add column if not exists preview_public_url text",
                "alter table mirage_job_images add column if not exists inference_storage_key text",
                "alter table mirage_job_images add column if not exists inference_public_url text",
                "alter table mirage_job_images add column if not exists inference_local_path text",
                "alter table mirage_job_images add column if not exists optimized_width integer",
                "alter table mirage_job_images add column if not exists optimized_height integer",
                "alter table mirage_job_images add column if not exists optimized_sha256 text",
            ]
            for statement in statements:
                await conn.execute(statement)
        finally:
            await conn.close()

    async def _set_job_asset_state(self, job_id: str, asset_state: str) -> None:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            await conn.execute(
                """
                update mirage_jobs
                set asset_state = $2,
                    updated_at = now()
                where id = $1::uuid
                """,
                job_id,
                asset_state,
            )
        finally:
            await conn.close()

    def _download_sources(self, job_id: str, rows: list[dict[str, Any]]) -> dict[str, Path]:
        with self._timed("assets.download_sources", jobId=job_id, imageCount=len(rows)):
            total = len(rows)
            self._emit_progress(stage="downloading", current=0, total=total, message="Downloading source images...")
            max_workers = min(max(1, self.settings.image_workers), total)
            downloaded: dict[str, Path] = {}
            completed = 0
            with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mirage-asset-download") as executor:
                future_map = {
                    executor.submit(self.db.download_job_source_image, row): str(row["id"])
                    for row in rows
                }
                for future in as_completed(future_map):
                    image_id = future_map[future]
                    downloaded[image_id] = future.result()
                    completed += 1
                    self._emit_progress(
                        stage="downloading",
                        current=completed,
                        total=total,
                        message=f"Downloading source images... {completed}/{total}",
                    )
            return downloaded

    def _optimize_variants(self, job_id: str, rows: list[dict[str, Any]], sources: dict[str, Path]) -> dict[str, dict[str, Any]]:
        with self._timed("assets.optimize_variants", jobId=job_id, imageCount=len(rows)):
            total = len(rows)
            self._emit_progress(stage="optimizing", current=0, total=total, message="Optimizing images locally...")
            max_workers = min(max(1, self.settings.image_workers), total)
            optimized: dict[str, dict[str, Any]] = {}
            completed = 0
            with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mirage-asset-optimize") as executor:
                future_map = {
                    executor.submit(self._optimize_row, job_id, row, sources[str(row["id"])]): str(row["id"])
                    for row in rows
                }
                for future in as_completed(future_map):
                    image_id = future_map[future]
                    optimized[image_id] = future.result()
                    completed += 1
                    self._emit_progress(
                        stage="optimizing",
                        current=completed,
                        total=total,
                        message=f"Optimizing images locally... {completed}/{total}",
                    )
            return optimized

    def _upload_variants(self, job_id: str, rows: list[dict[str, Any]], optimized: dict[str, dict[str, Any]]) -> list[AssetResult]:
        with self._timed("assets.upload_variants", jobId=job_id, imageCount=len(rows)):
            total = len(rows)
            self._emit_progress(stage="uploading", current=0, total=total, message="Uploading optimized assets to S3...")
            max_workers = min(max(1, self.settings.image_workers), total)
            results: list[AssetResult] = []
            completed = 0
            with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mirage-asset-upload") as executor:
                future_map = {
                    executor.submit(self._finalize_row, job_id, row, optimized.get(str(row["id"]))): str(row["id"])
                    for row in rows
                }
                for future in as_completed(future_map):
                    results.append(future.result())
                    completed += 1
                    self._emit_progress(
                        stage="uploading",
                        current=completed,
                        total=total,
                        message=f"Uploading optimized assets to S3... {completed}/{total}",
                    )
            return results

    async def _claim_job_asset_images(
        self,
        job_id: str,
        *,
        batch_size: int | None,
        retry_failed_only: bool,
    ) -> list[dict[str, Any]]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            if retry_failed_only:
                status_clause = "asset_status = 'failed'"
            else:
                status_clause = "asset_status in ('pending', 'failed')"
            if batch_size is None:
                rows = await conn.fetch(
                    f"""
                    select *
                    from mirage_job_images
                    where job_id = $1::uuid
                      and {status_clause}
                    order by display_order
                    """,
                    job_id,
                )
            else:
                rows = await conn.fetch(
                    f"""
                    select *
                    from mirage_job_images
                    where job_id = $1::uuid
                      and {status_clause}
                    order by display_order
                    limit $2
                    """,
                    job_id,
                    batch_size,
                )
            claimed = [dict(row) for row in rows]
            if not claimed:
                return []
            image_ids = [str(row["id"]) for row in claimed]
            await conn.execute(
                """
                update mirage_job_images
                set asset_status = 'downloading',
                    asset_error = null,
                    asset_attempt_count = asset_attempt_count + 1,
                    updated_at = now()
                where id = any($1::uuid[])
                """,
                image_ids,
            )
            return claimed
        finally:
            await conn.close()

    async def _save_asset_results(self, job_id: str, results: list[AssetResult]) -> None:
        if not results:
            return
        with self._timed("assets.save_asset_results", jobId=job_id, resultCount=len(results)):
            conn = await asyncpg.connect(self.database_url, timeout=20)
            try:
                async with conn.transaction():
                    await conn.executemany(
                        """
                        update mirage_job_images
                        set asset_status = $2,
                            asset_error = $3,
                            source_mime_type = $4,
                            source_extension = $5,
                            optimized_format = $6,
                            thumb_storage_key = $7,
                            thumb_public_url = $8,
                            preview_storage_key = $9,
                            preview_public_url = $10,
                            inference_storage_key = $11,
                            inference_public_url = $12,
                            inference_local_path = $13,
                            optimized_width = $14,
                            optimized_height = $15,
                            optimized_sha256 = $16,
                            asset_optimized_at = case when $2 = 'ready' then now() else asset_optimized_at end,
                            updated_at = now()
                        where id = $1::uuid
                        """,
                        [
                            (
                                result.job_image_id,
                                result.asset_status,
                                result.asset_error,
                                result.source_mime_type,
                                result.source_extension,
                                result.optimized_format,
                                result.thumb_storage_key,
                                result.thumb_public_url,
                                result.preview_storage_key,
                                result.preview_public_url,
                                result.inference_storage_key,
                                result.inference_public_url,
                                result.inference_local_path,
                                result.optimized_width,
                                result.optimized_height,
                                result.optimized_sha256,
                            )
                            for result in results
                        ],
                    )

                    failed_image_ids = [result.job_image_id for result in results if result.asset_status == "failed"]
                    ready_image_ids = [result.job_image_id for result in results if result.asset_status == "ready"]

                    if failed_image_ids:
                        await conn.execute(
                            """
                            update inference_user_image_status
                            set status = 'failed',
                                reason = 'asset_optimization_failed',
                                updated_at = now()
                            where job_id = $1::uuid
                              and image_id = any($2::uuid[])
                              and model_version = $3
                              and preprocessing_version = $4
                              and status = 'pending'
                            """,
                            job_id,
                            failed_image_ids,
                            self.settings.model_version,
                            self.settings.preprocessing_version,
                        )

                    if ready_image_ids:
                        await conn.execute(
                            """
                            update inference_user_image_status
                            set status = 'pending',
                                best_score = null,
                                matched_face_index = null,
                                matched_anchor_id = null,
                                reason = 'asset_optimization_recovered',
                                updated_at = now()
                            where job_id = $1::uuid
                              and image_id = any($2::uuid[])
                              and model_version = $3
                              and preprocessing_version = $4
                              and status = 'failed'
                              and reason = 'asset_optimization_failed'
                            """,
                            job_id,
                            ready_image_ids,
                            self.settings.model_version,
                            self.settings.preprocessing_version,
                        )
            finally:
                await conn.close()

    async def _refresh_job_asset_state(self, job_id: str) -> dict[str, Any]:
        with self._timed("assets.refresh_job_asset_state", jobId=job_id):
            conn = await asyncpg.connect(self.database_url, timeout=20)
            try:
                rows = await conn.fetch(
                    """
                    select asset_status
                    from mirage_job_images
                    where job_id = $1::uuid
                    """,
                    job_id,
                )
                counts: dict[str, int] = {}
                for row in rows:
                    status_name = str(row["asset_status"] or "pending")
                    counts[status_name] = counts.get(status_name, 0) + 1

                total = len(rows)
                pending = counts.get("pending", 0)
                downloading = counts.get("downloading", 0)
                optimizing = counts.get("optimizing", 0)
                uploading = counts.get("uploading", 0)
                ready = counts.get("ready", 0)
                failed = counts.get("failed", 0)
                if total == 0:
                    asset_state = "idle"
                elif downloading > 0 or pending > 0:
                    asset_state = "downloading"
                elif optimizing > 0:
                    asset_state = "optimizing"
                elif uploading > 0:
                    asset_state = "uploading"
                elif ready == total:
                    asset_state = "ready"
                elif ready + failed == total and failed > 0:
                    asset_state = "failed"
                else:
                    asset_state = "idle"

                stats = {
                    "total": total,
                    "ready": ready,
                    "failed": failed,
                    "pending": pending,
                    "downloading": downloading,
                    "optimizing": optimizing,
                    "uploading": uploading,
                }
                await conn.execute(
                    """
                    update mirage_jobs
                    set asset_state = $2,
                        asset_stats_json = $3::jsonb,
                        updated_at = now()
                    where id = $1::uuid
                    """,
                    job_id,
                    asset_state,
                    json.dumps(stats),
                )
                return {"assetState": asset_state, "assetStats": stats}
            finally:
                await conn.close()

    def _rehydrate_local_inference_cache(self, job_id: str) -> int:
        with self._timed("assets.rehydrate_local_inference_cache", jobId=job_id):
            rows = self._run(self._fetch_ready_assets(job_id))
            restored = 0
            for row in rows:
                local_path = self._expected_inference_path(job_id, str(row["id"]))
                existing_path = row.get("inference_local_path")
                if existing_path and Path(str(existing_path)).exists():
                    continue
                source_path = self.db.download_job_source_image(row)
                image = self._open_image(source_path)
                self._save_variant(image, local_path, max_size=1024, fmt="JPEG", quality=85)
                self._run(self._update_local_cache_path(str(row["id"]), str(local_path)))
                restored += 1
            return restored

    async def _fetch_ready_assets(self, job_id: str) -> list[dict[str, Any]]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            rows = await conn.fetch(
                """
                select id, drive_file_id, filename, mime_type, job_id, inference_local_path
                from mirage_job_images
                where job_id = $1::uuid
                  and asset_status = 'ready'
                order by display_order
                """,
                job_id,
            )
            return [dict(row) for row in rows]
        finally:
            await conn.close()

    async def _update_local_cache_path(self, image_id: str, local_path: str) -> None:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            await conn.execute(
                """
                update mirage_job_images
                set inference_local_path = $2,
                    updated_at = now()
                where id = $1::uuid
                """,
                image_id,
                local_path,
            )
        finally:
            await conn.close()

    def _process_row(self, job: dict[str, Any], row: dict[str, Any]) -> AssetResult:
        job_id = str(job["id"])
        image_id = str(row["id"])
        return self._finalize_row(job_id, row, self._optimize_row(job_id, row, self.db.download_job_source_image(row)))

    def _optimize_row(self, job_id: str, row: dict[str, Any], source_path: Path) -> dict[str, Any]:
        image_id = str(row["id"])
        try:
            image = self._open_image(source_path)
            source_extension = source_path.suffix.lower() or Path(str(row.get("filename") or "")).suffix.lower() or ".jpg"
            source_mime_type = str(row.get("mime_type") or mimetypes.guess_type(source_path.name)[0] or "image/jpeg")
            width, height = image.size

            thumb_path = self.job_asset_root / job_id / "thumb" / f"{image_id}.webp"
            preview_path = self.job_asset_root / job_id / "preview" / f"{image_id}.webp"
            inference_path = self._expected_inference_path(job_id, image_id)

            self._save_variant(image, thumb_path, max_size=400, fmt="WEBP", quality=74)
            self._save_variant(image, preview_path, max_size=1600, fmt="WEBP", quality=82)
            self._save_variant(image, inference_path, max_size=1024, fmt="JPEG", quality=85)

            return {
                "job_image_id": image_id,
                "source_mime_type": source_mime_type,
                "source_extension": source_extension,
                "optimized_format": "webp/jpeg",
                "thumb_path": thumb_path,
                "preview_path": preview_path,
                "inference_path": inference_path,
                "optimized_width": width,
                "optimized_height": height,
                "optimized_sha256": self._sha256_file(inference_path),
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "job_image_id": image_id,
                "asset_status": "failed",
                "asset_error": str(exc),
                "source_mime_type": str(row.get("mime_type") or "") or None,
                "source_extension": Path(str(row.get("filename") or "")).suffix.lower() or None,
                "optimized_format": None,
                "thumb_path": None,
                "preview_path": None,
                "inference_path": None,
                "optimized_width": None,
                "optimized_height": None,
                "optimized_sha256": None,
            }

    def _finalize_row(self, job_id: str, row: dict[str, Any], optimized: dict[str, Any] | None) -> AssetResult:
        image_id = str(row["id"])
        if not optimized or optimized.get("asset_status") == "failed":
            return AssetResult(
                job_image_id=image_id,
                asset_status="failed",
                asset_error=(optimized or {}).get("asset_error") if optimized else "Optimization failed.",
                source_mime_type=(optimized or {}).get("source_mime_type"),
                source_extension=(optimized or {}).get("source_extension"),
                optimized_format=(optimized or {}).get("optimized_format"),
                thumb_storage_key=None,
                thumb_public_url=None,
                preview_storage_key=None,
                preview_public_url=None,
                inference_storage_key=None,
                inference_public_url=None,
                inference_local_path=None,
                optimized_width=(optimized or {}).get("optimized_width"),
                optimized_height=(optimized or {}).get("optimized_height"),
                optimized_sha256=(optimized or {}).get("optimized_sha256"),
            )

        thumb_key = f"mirage/jobs/{job_id}/thumb/{image_id}.webp"
        preview_key = f"mirage/jobs/{job_id}/preview/{image_id}.webp"
        thumb_url = self._upload_file(optimized["thumb_path"], thumb_key, "image/webp")
        preview_url = self._upload_file(optimized["preview_path"], preview_key, "image/webp")

        return AssetResult(
            job_image_id=image_id,
            asset_status="ready",
            asset_error=None,
            source_mime_type=optimized.get("source_mime_type"),
            source_extension=optimized.get("source_extension"),
            optimized_format=optimized.get("optimized_format"),
            thumb_storage_key=thumb_key,
            thumb_public_url=thumb_url,
            preview_storage_key=preview_key,
            preview_public_url=preview_url,
            inference_storage_key=None,
            inference_public_url=None,
            inference_local_path=str(optimized["inference_path"]),
            optimized_width=optimized.get("optimized_width"),
            optimized_height=optimized.get("optimized_height"),
            optimized_sha256=optimized.get("optimized_sha256"),
        )

    def _expected_inference_path(self, job_id: str, image_id: str) -> Path:
        return self.job_asset_root / job_id / "inference" / f"{image_id}.jpg"

    def _write_manifest(self, job_id: str) -> None:
        rows = self._run(self._fetch_manifest_rows(job_id))
        manifest_path = self.job_asset_root / job_id / "manifest.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    async def _fetch_manifest_rows(self, job_id: str) -> list[dict[str, Any]]:
        conn = await asyncpg.connect(self.database_url, timeout=20)
        try:
            rows = await conn.fetch(
                """
                select id::text as id,
                       filename,
                       asset_status,
                       thumb_public_url,
                       preview_public_url,
                       inference_local_path
                from mirage_job_images
                where job_id = $1::uuid
                order by display_order
                """,
                job_id,
            )
            return [dict(row) for row in rows]
        finally:
            await conn.close()

    def _s3_client(self):
        kwargs: dict[str, Any] = {
            "region_name": self.settings.mirage_s3_region,
            "config": BotoConfig(signature_version="s3v4"),
        }
        if self.settings.mirage_s3_endpoint_url:
            kwargs["endpoint_url"] = self.settings.mirage_s3_endpoint_url
        if self.settings.aws_access_key_id and self.settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = self.settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = self.settings.aws_secret_access_key
            if self.settings.aws_session_token:
                kwargs["aws_session_token"] = self.settings.aws_session_token
        return boto3.client("s3", **kwargs)

    def _upload_file(self, local_path: Path, object_key: str, content_type: str) -> str:
        client = self._s3_client()
        client.upload_file(
            Filename=str(local_path),
            Bucket=self.settings.mirage_s3_bucket_name,
            Key=object_key,
            ExtraArgs={
                "ContentType": content_type,
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
        base = str(self.settings.mirage_s3_public_base_url or "").rstrip("/")
        if not base:
            base = f"https://{self.settings.mirage_s3_bucket_name}.s3.{self.settings.mirage_s3_region}.amazonaws.com"
        return f"{base}/{object_key}"

    def _open_image(self, source_path: Path) -> Image.Image:
        try:
            if source_path.suffix.lower() in {".tif", ".tiff"}:
                with Image.open(source_path) as image:
                    largest = _largest_tiff_frame(image)
                return ImageOps.exif_transpose(largest).convert("RGB")
            with Image.open(source_path) as image:
                normalized = ImageOps.exif_transpose(image)
                return normalized.copy()
        except UnidentifiedImageError:
            if source_path.suffix.lower() not in RAW_EXTENSIONS:
                raise
            if rawpy is None:
                raise RuntimeError(
                    f"{source_path.suffix.lower()} requires rawpy for RAW decoding on this machine."
                ) from None
            with rawpy.imread(str(source_path)) as raw:
                rgb = raw.postprocess()
            return Image.fromarray(rgb)

    def _save_variant(self, image: Image.Image, output_path: Path, *, max_size: int, fmt: str, quality: int) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        candidate = image.copy()
        if candidate.mode not in ("RGB", "RGBA"):
            candidate = candidate.convert("RGB")
        candidate.thumbnail((max_size, max_size))
        if fmt.upper() == "WEBP":
            if candidate.mode != "RGB":
                candidate = candidate.convert("RGB")
            candidate.save(output_path, "WEBP", quality=quality, method=6)
            return
        if fmt.upper() == "JPEG":
            if candidate.mode != "RGB":
                candidate = candidate.convert("RGB")
            candidate.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True)
            return
        raise RuntimeError(f"Unsupported optimized format: {fmt}")

    @staticmethod
    def _sha256_file(path: Path) -> str:
        digest = sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
