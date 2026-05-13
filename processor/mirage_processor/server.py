from __future__ import annotations

import threading
import time
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError

from .config import Settings, load_settings
from .database import MirageDatabase
from .assets import JobAssetOptimizer
from .face import FaceEngine
from .telemetry import JsonlTelemetrySink, RunTelemetry
from .worker import AnchorIndexCache, MirageWorker


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class ProcessJobRequest(BaseModel):
    batchSize: int | None = Field(default=None, ge=1, le=500)
    anchorLimit: int | None = Field(default=None, ge=1, le=100)
    userId: str | None = None
    retryRejectedAnchors: bool = True
    threshold: float | None = None
    reviewThreshold: float | None = None
    margin: float | None = None
    topK: int | None = Field(default=None, ge=1, le=100)


class BackendProxyRequest(BaseModel):
    backendUrl: str
    method: str = "GET"
    path: str
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None


class OptimizeAssetsRequest(BaseModel):
    batchSize: int | None = Field(default=None, ge=1, le=500)
    retryFailedOnly: bool = False


class ProcessorRunState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.running = False
        self.kind = "idle"
        self.job_id: str | None = None
        self.started_at: float | None = None
        self.completed_at: float | None = None
        self.message = "Idle."
        self.last_result: dict[str, Any] | None = None
        self.last_error: str | None = None
        self.progress: dict[str, Any] | None = None
        self.telemetry: RunTelemetry | None = None
        self.last_timings: dict[str, Any] | None = None

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "running": self.running,
                "kind": self.kind,
                "jobId": self.job_id,
                "startedAt": self.started_at,
                "completedAt": self.completed_at,
                "message": self.message,
                "lastResult": self.last_result,
                "lastError": self.last_error,
                "progress": self.progress,
                "timings": self.telemetry.snapshot() if self.telemetry is not None else self.last_timings,
            }

    def start(self, *, kind: str, job_id: str | None, message: str, telemetry: RunTelemetry | None = None) -> None:
        with self._lock:
            self.running = True
            self.kind = kind
            self.job_id = job_id
            self.started_at = time.time()
            self.completed_at = None
            self.message = message
            self.last_result = None
            self.last_error = None
            self.progress = None
            self.telemetry = telemetry
            self.last_timings = None

    def update_progress(self, progress: dict[str, Any] | None = None, *, message: str | None = None) -> None:
        with self._lock:
            if progress is not None:
                self.progress = progress
                if self.telemetry is not None and progress.get("stage"):
                    self.telemetry.record_progress(
                        stage=str(progress.get("stage")),
                        current=int(progress.get("current", 0)),
                        total=int(progress.get("total", 0)),
                        percent=progress.get("percent"),
                        message=message,
                    )
            if message is not None:
                self.message = message

    def success(self, *, message: str, result: dict[str, Any]) -> None:
        with self._lock:
            self.running = False
            self.completed_at = time.time()
            self.message = message
            self.last_timings = self.telemetry.finalize("completed") if self.telemetry is not None else None
            self.last_result = {**result, "timings": self.last_timings} if self.last_timings is not None else result
            self.last_error = None
            self.progress = None
            self.telemetry = None

    def fail(self, error: str) -> None:
        with self._lock:
            self.running = False
            self.completed_at = time.time()
            self.message = "Failed."
            self.last_error = error
            self.progress = None
            self.last_timings = self.telemetry.finalize("failed") if self.telemetry is not None else None
            self.telemetry = None


def _check_database(settings: Settings) -> bool:
    try:
        db = MirageDatabase(settings)
        return db.is_available()
    except Exception:
        return False


def build_worker(settings: Settings, payload: ProcessJobRequest | None = None) -> MirageWorker:
    payload = payload or ProcessJobRequest()
    db = MirageDatabase(settings)
    faces = FaceEngine(settings)
    cache = AnchorIndexCache(settings.data_dir / "anchor-index")
    return MirageWorker(
        db=db,
        face_engine=faces,
        face_engine_factory=lambda: FaceEngine(settings),
        index_cache=cache,
        threshold=float(payload.threshold if payload.threshold is not None else settings.default_threshold),
        margin=float(payload.margin if payload.margin is not None else settings.match_margin),
        review_threshold=float(
            payload.reviewThreshold if payload.reviewThreshold is not None else settings.review_threshold
        ),
        top_k=int(payload.topK if payload.topK is not None else settings.match_top_k),
        match_workers=settings.match_workers,
        anchor_workers=settings.anchor_workers,
        image_workers=settings.image_workers,
    )


def create_app(
    *,
    settings: Settings | None = None,
    worker_factory: Callable[[], MirageWorker] | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    app = FastAPI(title="Mirage Local Processor", version="1.0.0")
    lock = threading.Lock()
    run_state = ProcessorRunState()
    backend_token_cache: dict[str, str] = {}
    latency_sink = JsonlTelemetrySink(Path(__file__).resolve().parents[2] / "processor" / "logs" / "mirage-latency.jsonl")

    def log_event(event: str, **fields: Any) -> None:
        latency_sink.write({"kind": "control-plane", "event": event, **fields})

    @contextmanager
    def log_span(event: str, **fields: Any) -> Iterator[None]:
        started_at = time.perf_counter()
        log_event(f"{event}.start", **fields)
        try:
            yield
        except Exception as exc:
            log_event(
                f"{event}.end",
                status="error",
                durationMs=round((time.perf_counter() - started_at) * 1000, 2),
                error=str(exc),
                **fields,
            )
            raise
        else:
            log_event(
                f"{event}.end",
                status="ok",
                durationMs=round((time.perf_counter() - started_at) * 1000, 2),
                **fields,
            )

    @app.exception_handler(APIError)
    def handle_api_error(request: Request, exc: APIError) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={"detail": f"Database API Error: {exc.message}"}
        )

    def get_ops_backend_url(raw_value: str | None) -> str:
        candidate = (raw_value or settings.ops_backend_url or "").strip().rstrip("/")
        if not candidate:
            raise HTTPException(status_code=400, detail="Mirage Ops backend URL is not configured.")
        if not candidate.startswith(("http://", "https://")):
            candidate = f"https://{candidate}"
        return candidate

    def fetch_backend_admin_token(backend_url: str, *, force_refresh: bool = False) -> str:
        if not settings.ops_admin_username or not settings.ops_admin_password:
            raise HTTPException(
                status_code=401,
                detail="Mirage Ops local admin credentials are not configured.",
            )
        if not force_refresh and backend_token_cache.get(backend_url):
            return backend_token_cache[backend_url]

        try:
            with log_span("backend.admin_login", backendUrl=backend_url, forceRefresh=force_refresh):
                with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                    response = client.post(
                        f"{backend_url}/api/v1/auth/admin/login",
                        json={
                            "username": settings.ops_admin_username,
                            "password": settings.ops_admin_password,
                        },
                    )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Could not reach backend: {exc}") from exc

        if response.status_code >= 400:
            detail = response.text or f"HTTP {response.status_code}"
            raise HTTPException(status_code=response.status_code, detail=detail)

        token = response.json().get("access_token")
        if not token:
            raise HTTPException(status_code=502, detail="Backend admin login did not return an access token.")
        backend_token_cache[backend_url] = token
        return token

    def check_backend_database() -> tuple[bool, str | None]:
        try:
            backend_url = get_ops_backend_url(settings.ops_backend_url)
            token = fetch_backend_admin_token(backend_url)
            with log_span("backend.healthcheck_jobs", backendUrl=backend_url):
                with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                    response = client.get(
                        f"{backend_url}/api/v1/admin-panel/mirage/jobs",
                        headers={"authorization": f"Bearer {token}"},
                    )
                    if response.status_code in {401, 403}:
                        token = fetch_backend_admin_token(backend_url, force_refresh=True)
                        response = client.get(
                            f"{backend_url}/api/v1/admin-panel/mirage/jobs",
                            headers={"authorization": f"Bearer {token}"},
                        )
        except HTTPException as exc:
            return False, str(exc.detail)
        except httpx.HTTPError as exc:
            return False, f"Could not reach backend database: {exc}"

        if response.status_code >= 400:
            return False, response.text or f"HTTP {response.status_code}"
        return True, None

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.processor_allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root() -> dict:
        return {
            "status": "ok",
            "service": "mirage-local-processor",
            "port": settings.processor_port,
            "dashboard": "/dashboard",
        }

    @app.get("/dashboard", include_in_schema=False)
    def local_dashboard_redirect() -> RedirectResponse:
        return RedirectResponse(url="/dashboard/")

    @app.get("/health")
    def health() -> dict:
        local_db_connected = _check_database(settings)
        backend_db_connected, backend_db_error = check_backend_database()
        return {
            "status": "ok",
            "service": "mirage-local-processor",
            "port": settings.processor_port,
            "modelVersion": settings.model_version,
            "preprocessingVersion": settings.preprocessing_version,
            "databaseConnected": backend_db_connected,
            "backendDatabaseConnected": backend_db_connected,
            "backendDatabaseError": backend_db_error,
            "localDatabaseConnected": local_db_connected,
            "runState": run_state.snapshot(),
            "opsBackendUrl": settings.ops_backend_url,
            "autoAdminConfigured": bool(settings.ops_admin_username and settings.ops_admin_password),
        }

    @app.post("/dashboard/api/backend")
    def proxy_backend(payload: BackendProxyRequest) -> Response:
        backend_url = get_ops_backend_url(payload.backendUrl)
        path = payload.path if payload.path.startswith("/") else f"/{payload.path}"
        if not path.startswith("/api/v1/"):
            raise HTTPException(status_code=400, detail="Only /api/v1 backend paths can be proxied.")

        method = payload.method.upper()
        if method not in {"GET", "POST", "PATCH", "DELETE"}:
            raise HTTPException(status_code=400, detail="Unsupported backend method.")

        headers = {
            key: value
            for key, value in payload.headers.items()
            if key.lower() in {"authorization", "content-type"}
        }
        if payload.body is not None:
            headers.setdefault("content-type", "application/json")
        used_auto_auth = False
        if "authorization" not in {key.lower(): value for key, value in headers.items()} and path != "/api/v1/auth/admin/login":
            token = fetch_backend_admin_token(backend_url)
            headers["authorization"] = f"Bearer {token}"
            used_auto_auth = True

        try:
            with log_span("backend.proxy_request", backendUrl=backend_url, method=method, path=path):
                with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                    response = client.request(
                        method,
                        f"{backend_url}{path}",
                        headers=headers,
                        json=payload.body if payload.body is not None else None,
                    )
                    if used_auto_auth and response.status_code in {401, 403}:
                        token = fetch_backend_admin_token(backend_url, force_refresh=True)
                        headers["authorization"] = f"Bearer {token}"
                        response = client.request(
                            method,
                            f"{backend_url}{path}",
                            headers=headers,
                            json=payload.body if payload.body is not None else None,
                        )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Could not reach backend: {exc}") from exc

        content_type = response.headers.get("content-type", "application/json")
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=content_type,
        )

    dashboard_root = Path(__file__).resolve().parents[2] / "mirage-mapping-dashboard"
    dashboard_dir = dashboard_root / "dist" if (dashboard_root / "dist").is_dir() else dashboard_root
    if dashboard_dir.is_dir():
        app.mount(
            "/dashboard",
            StaticFiles(directory=str(dashboard_dir), html=True),
            name="mirage_mapping_dashboard",
        )

    def require_processor_token(token: str | None) -> None:
        if settings.processor_token and token != settings.processor_token:
            raise HTTPException(status_code=401, detail="Invalid Mirage processor token.")

    def start_background_run(
        *,
        kind: str,
        job_id: str | None,
        payload: ProcessJobRequest,
        message: str,
        runner: Callable[[Callable[[dict[str, Any] | None, str | None], None], RunTelemetry], dict[str, Any]],
    ) -> dict[str, Any]:
        if not lock.acquire(blocking=False):
            raise HTTPException(
                status_code=409,
                detail="Mirage processor is already running a job on this machine.",
            )

        telemetry = RunTelemetry(sink=latency_sink, kind=kind, job_id=job_id)
        run_state.start(kind=kind, job_id=job_id, message=message, telemetry=telemetry)

        def push_progress(progress: dict[str, Any] | None = None, message: str | None = None) -> None:
            run_state.update_progress(progress, message=message)

        def target() -> None:
            try:
                result = runner(push_progress, telemetry)
                run_state.success(message="Completed.", result=result)
            except Exception as exc:  # noqa: BLE001
                run_state.fail(str(exc))
            finally:
                lock.release()

        thread = threading.Thread(target=target, name=f"mirage-{kind}", daemon=True)
        thread.start()
        return {
            "status": "accepted",
            "jobId": job_id,
            "runState": run_state.snapshot(),
        }

    def attach_telemetry(target: Any, telemetry: RunTelemetry, push_progress: Callable[[dict[str, Any] | None, str | None], None] | None = None) -> Any:
        if hasattr(target, "telemetry"):
            target.telemetry = telemetry
        db = getattr(target, "db", None)
        if db is not None and hasattr(db, "telemetry"):
            db.telemetry = telemetry
        if push_progress is not None and hasattr(target, "progress_callback"):
            target.progress_callback = push_progress
        return target

    @app.get("/runs/current")
    def current_run() -> dict[str, Any]:
        snapshot = run_state.snapshot()
        snapshot["databaseConnected"] = check_backend_database()[0]
        snapshot["localDatabaseConnected"] = _check_database(settings)
        return snapshot

    @app.get("/jobs/{job_id}/detail")
    async def local_job_detail(job_id: str) -> dict[str, Any]:
        backend_root = str(BACKEND_ROOT)
        if backend_root not in sys.path:
            sys.path.insert(0, backend_root)
        from app.db.supabase_client import get_client as get_backend_client
        from app.services.mirage_pipeline_service import get_mirage_job_detail as get_backend_job_detail

        with log_span("job.detail", jobId=job_id):
            supabase = await get_backend_client()
            return await get_backend_job_detail(supabase, job_id)

    @app.post("/jobs/{job_id}/process")
    def process_job(
        job_id: str,
        payload: ProcessJobRequest | None = None,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict:
        require_processor_token(x_mirage_processor_token)
        payload = payload or ProcessJobRequest()
        if not lock.acquire(blocking=False):
            raise HTTPException(
                status_code=409,
                detail="Mirage processor is already running a job on this machine.",
            )
        telemetry = RunTelemetry(sink=latency_sink, kind="job-process-sync", job_id=job_id)
        success = False
        try:
            with log_span("job.process_sync", jobId=job_id):
                worker = worker_factory() if worker_factory is not None else build_worker(settings, payload)
                attach_telemetry(worker, telemetry)
                db = getattr(worker, "db", None)
                if payload.retryRejectedAnchors and db is not None and hasattr(db, "reset_retryable_anchor_images"):
                    db.reset_retryable_anchor_images()
                if db is not None and hasattr(db, "reset_processing_anchor_images"):
                    db.reset_processing_anchor_images(payload.userId)
                if db is not None and hasattr(db, "get_job_asset_counts"):
                    asset_counts = db.get_job_asset_counts(job_id)
                    total_assets = int(asset_counts.get("total", 0))
                    ready_assets = int(asset_counts.get("ready", 0))
                    failed_assets = int(asset_counts.get("failed", 0))
                    if ready_assets == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="Optimize images first. No ready optimized inference assets were found for this job.",
                        )
                    if total_assets > 0 and ready_assets + failed_assets < total_assets:
                        raise HTTPException(
                            status_code=400,
                            detail="Wait for image optimization to finish for this job before starting local mapping.",
                        )
                anchors = worker.run_anchor_cycle(
                    limit=int(payload.anchorLimit or settings.anchor_batch_size),
                    user_id=payload.userId,
                )
                batch_size = int(payload.batchSize or settings.job_batch_size)
                stats = worker.run_job_by_id(job_id, batch_size)
                success = True
        finally:
            telemetry.finalize("completed" if success else "failed")
            lock.release()

        if int(stats.get("jobs", 0)) == 0:
            raise HTTPException(status_code=404, detail="Mirage job not found or not claimable.")

        return {
            "jobId": job_id,
            "status": "completed",
            "anchors": anchors,
            "stats": stats,
        }

    @app.post("/jobs/{job_id}/start")
    def start_job_processing(
        job_id: str,
        payload: ProcessJobRequest | None = None,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict:
        require_processor_token(x_mirage_processor_token)
        payload = payload or ProcessJobRequest()

        def runner(push_progress: Callable[[dict[str, Any] | None, str | None], None], telemetry: RunTelemetry) -> dict[str, Any]:
            worker = worker_factory() if worker_factory is not None else build_worker(settings, payload)
            attach_telemetry(worker, telemetry, push_progress)
            db = getattr(worker, "db", None)
            if payload.retryRejectedAnchors and db is not None and hasattr(db, "reset_retryable_anchor_images"):
                db.reset_retryable_anchor_images()
            if db is not None and hasattr(db, "get_job_asset_counts"):
                asset_counts = db.get_job_asset_counts(job_id)
                total_assets = int(asset_counts.get("total", 0))
                ready_assets = int(asset_counts.get("ready", 0))
                failed_assets = int(asset_counts.get("failed", 0))
                if ready_assets == 0:
                    raise RuntimeError("Optimize images first. No ready optimized inference assets were found for this job.")
                if total_assets > 0 and ready_assets + failed_assets < total_assets:
                    raise RuntimeError("Wait for image optimization to finish for this job before starting local mapping.")
            anchors = worker.run_anchor_cycle(limit=int(payload.anchorLimit or settings.anchor_batch_size))
            push_progress(
                {
                    "stage": "mapping",
                    "label": "mapping",
                    "current": 0,
                    "total": 1,
                    "percent": 0,
                },
                message="Mapping optimized images on the local GPU.",
            )
            stats = worker.run_job_by_id(job_id, int(payload.batchSize or settings.job_batch_size))
            if int(stats.get("jobs", 0)) == 0:
                raise RuntimeError("Mirage job not found or not claimable.")
            return {
                "jobId": job_id,
                "anchors": anchors,
                "stats": stats,
            }

        return start_background_run(
            kind="job",
            job_id=job_id,
            payload=payload,
            message=f"Processing job {job_id} on the local GPU.",
            runner=runner,
        )

    @app.post("/jobs/{job_id}/optimize-assets")
    def optimize_job_assets(
        job_id: str,
        payload: OptimizeAssetsRequest | None = None,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_processor_token(x_mirage_processor_token)
        payload = payload or OptimizeAssetsRequest()

        def runner(push_progress: Callable[[dict[str, Any] | None, str | None], None], telemetry: RunTelemetry) -> dict[str, Any]:
            db = MirageDatabase(settings, telemetry=telemetry)
            optimizer = JobAssetOptimizer(settings=settings, db=db, progress_callback=push_progress, telemetry=telemetry)
            return optimizer.run(
                job_id,
                batch_size=int(payload.batchSize or settings.job_batch_size),
                retry_failed_only=bool(payload.retryFailedOnly),
            )

        return start_background_run(
            kind="optimize-assets",
            job_id=job_id,
            payload=ProcessJobRequest(),
            message=f"Optimizing job assets for {job_id} on this machine.",
            runner=runner,
        )

    @app.post("/jobs/{job_id}/approve")
    def approve_job(
        job_id: str,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_processor_token(x_mirage_processor_token)
        db = MirageDatabase(settings)
        try:
            with log_span("job.approve", jobId=job_id):
                return db.approve_job(job_id)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/jobs/{job_id}/publish")
    def publish_job(
        job_id: str,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_processor_token(x_mirage_processor_token)
        db = MirageDatabase(settings)
        try:
            with log_span("job.publish", jobId=job_id):
                return db.publish_job(job_id)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/jobs/{job_id}/unpublish")
    def unpublish_job(
        job_id: str,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_processor_token(x_mirage_processor_token)
        db = MirageDatabase(settings)
        try:
            with log_span("job.unpublish", jobId=job_id):
                return db.unpublish_job(job_id)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.delete("/jobs/{job_id}")
    def delete_job(
        job_id: str,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_processor_token(x_mirage_processor_token)
        if run_state.snapshot().get("running"):
            raise HTTPException(
                status_code=409,
                detail="Stop the active Mirage processor run before deleting a job.",
            )

        db = MirageDatabase(settings)
        cleanup_plan = db.get_job_asset_cleanup_plan(job_id)
        backend_url = get_ops_backend_url(settings.ops_backend_url)
        token = fetch_backend_admin_token(backend_url)

        try:
            with log_span("job.delete", jobId=job_id):
                with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                    response = client.delete(
                        f"{backend_url}/api/v1/admin-panel/mirage/jobs/{job_id}",
                        headers={"authorization": f"Bearer {token}"},
                    )
                    if response.status_code in {401, 403}:
                        token = fetch_backend_admin_token(backend_url, force_refresh=True)
                        response = client.delete(
                            f"{backend_url}/api/v1/admin-panel/mirage/jobs/{job_id}",
                            headers={"authorization": f"Bearer {token}"},
                        )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Could not reach backend: {exc}") from exc

        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Mirage job not found.")
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text or "Delete failed.")

        cleanup_error = None
        cleanup = {"deletedS3ObjectCount": 0, "removedLocalDirectoryCount": 0}
        try:
            cleanup = db.execute_job_asset_cleanup(cleanup_plan)
        except Exception as exc:  # noqa: BLE001
            cleanup_error = str(exc)

        return {
            "jobId": job_id,
            "status": "deleted",
            "cleanupError": cleanup_error,
            **cleanup,
        }

    @app.post("/anchors/process")
    def process_anchors(
        payload: ProcessJobRequest | None = None,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict:
        require_processor_token(x_mirage_processor_token)
        payload = payload or ProcessJobRequest()
        if not lock.acquire(blocking=False):
            raise HTTPException(
                status_code=409,
                detail="Mirage processor is already running a job on this machine.",
            )
        telemetry = RunTelemetry(sink=latency_sink, kind="anchors-process-sync", job_id=payload.userId)
        success = False
        try:
            with log_span("anchors.process_sync", userId=payload.userId, anchorLimit=int(payload.anchorLimit or settings.anchor_batch_size)):
                worker = worker_factory() if worker_factory is not None else build_worker(settings, payload)
                attach_telemetry(
                    worker,
                    telemetry,
                    lambda progress=None, message=None: telemetry.record_progress(
                        stage=str((progress or {}).get("stage") or "anchor-verification"),
                        current=int((progress or {}).get("current", 0)),
                        total=int((progress or {}).get("total", 0)),
                        percent=(progress or {}).get("percent"),
                        message=message,
                    ),
                )
                db = getattr(worker, "db", None)
                if payload.retryRejectedAnchors and db is not None and hasattr(db, "reset_retryable_anchor_images"):
                    db.reset_retryable_anchor_images()
                if db is not None and hasattr(db, "reset_processing_anchor_images"):
                    db.reset_processing_anchor_images(payload.userId)
                anchors = worker.run_anchor_cycle(
                    limit=int(payload.anchorLimit or settings.anchor_batch_size),
                    user_id=payload.userId,
                )
                success = True
        finally:
            telemetry.finalize("completed" if success else "failed")
            lock.release()

        return {"status": "completed", "userId": payload.userId, "anchors": anchors}

    @app.post("/poll-once")
    def poll_once(
        payload: ProcessJobRequest | None = None,
        x_mirage_processor_token: str | None = Header(default=None),
    ) -> dict:
        require_processor_token(x_mirage_processor_token)
        payload = payload or ProcessJobRequest()
        if not lock.acquire(blocking=False):
            raise HTTPException(
                status_code=409,
                detail="Mirage processor is already running a job on this machine.",
            )
        telemetry = RunTelemetry(sink=latency_sink, kind="poll-once")
        success = False
        try:
            with log_span("poll.once"):
                worker = worker_factory() if worker_factory is not None else build_worker(settings, payload)
                attach_telemetry(worker, telemetry)
                result = worker.run_once(
                    anchor_limit=settings.anchor_batch_size,
                    job_batch_size=int(payload.batchSize or settings.job_batch_size),
                )
                success = True
        finally:
            telemetry.finalize("completed" if success else "failed")
            lock.release()

        return {"status": "completed", "result": result}

    return app


def serve() -> None:
    import uvicorn

    settings = load_settings()
    uvicorn.run(
        create_app(settings=settings),
        host=settings.processor_host,
        port=settings.processor_port,
    )
