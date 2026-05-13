import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    supabase_url: str | None
    supabase_service_role_key: str | None
    mirage_database_url: str | None
    supabase_storage_bucket: str
    mirage_s3_bucket_name: str
    mirage_s3_region: str
    mirage_s3_endpoint_url: str | None
    mirage_s3_public_base_url: str | None
    aws_access_key_id: str | None
    aws_secret_access_key: str | None
    aws_session_token: str | None
    redis_url: str | None
    data_dir: Path
    default_threshold: float
    review_threshold: float
    match_top_k: int
    match_margin: float
    match_workers: int
    anchor_workers: int
    image_workers: int
    anchor_batch_size: int
    job_batch_size: int
    poll_interval_seconds: int
    insightface_model: str
    model_version: str
    preprocessing_version: str
    detection_size: int
    detection_threshold: float
    quality_threshold: float
    onnx_providers: list[str]
    google_application_credentials: Path | None
    required_anchor_count: int
    processor_host: str
    processor_port: int
    processor_allowed_origins: list[str]
    processor_token: str | None
    ops_backend_url: str
    ops_admin_username: str | None
    ops_admin_password: str | None


def _load_processor_allowed_origins() -> list[str]:
    raw_value = os.getenv("MIRAGE_PROCESSOR_ALLOWED_ORIGINS", "").strip()
    if not raw_value or raw_value == "*":
        return [
            "http://localhost:4175",
            "http://127.0.0.1:4175",
            "http://localhost:8765",
            "http://127.0.0.1:8765",
        ]
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


def load_settings() -> Settings:
    repo_root = Path(__file__).resolve().parents[2]
    backend_env = repo_root / "backend" / ".env"
    root_env = repo_root / ".env"

    if backend_env.is_file():
        load_dotenv(backend_env, override=False)
    if root_env.is_file():
        load_dotenv(root_env, override=False)
    else:
        load_dotenv()
    missing = []
    mirage_database_url = os.getenv("MIRAGE_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not mirage_database_url:
        if not (os.getenv("MIRAGE_SUPABASE_URL") or os.getenv("SUPABASE_URL")):
            missing.append("MIRAGE_SUPABASE_URL or SUPABASE_URL")
        if not (os.getenv("MIRAGE_SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")):
            missing.append("MIRAGE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY")

    if missing:
        raise RuntimeError(f"Missing environment variable(s): {', '.join(missing)}")

    providers_raw = os.getenv("MIRAGE_ONNXRUNTIME_PROVIDERS", "").strip()
    if providers_raw:
        providers = [provider.strip() for provider in providers_raw.split(",") if provider.strip()]
    else:
        try:
            import onnxruntime as ort

            available_providers = set(ort.get_available_providers())
        except Exception:
            available_providers = set()

        # Prefer the NVIDIA GPU path for local Mirage inference when available,
        # but keep CPU as a safe fallback for machines without CUDA runtime.
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in available_providers
            else ["CPUExecutionProvider"]
        )

    creds_raw = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    google_creds = Path(creds_raw).expanduser() if creds_raw else None

    insightface_model = os.getenv("MIRAGE_INSIGHTFACE_MODEL", "buffalo_l")
    mirage_supabase_url = os.getenv("MIRAGE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    mirage_supabase_service_role_key = (
        os.getenv("MIRAGE_SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    return Settings(
        supabase_url=mirage_supabase_url or None,
        supabase_service_role_key=mirage_supabase_service_role_key or None,
        mirage_database_url=mirage_database_url or None,
        supabase_storage_bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "submissions"),
        mirage_s3_bucket_name=os.getenv("MIRAGE_S3_BUCKET_NAME", "ascent-users"),
        mirage_s3_region=os.getenv("MIRAGE_S3_REGION", "ap-south-1"),
        mirage_s3_endpoint_url=os.getenv("MIRAGE_S3_ENDPOINT_URL") or None,
        mirage_s3_public_base_url=os.getenv("MIRAGE_S3_PUBLIC_BASE_URL") or None,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or None,
        aws_session_token=os.getenv("AWS_SESSION_TOKEN") or None,
        redis_url=os.getenv("REDIS_URL") or None,
        data_dir=Path(os.getenv("MIRAGE_PROCESSOR_DATA_DIR", "processor/data")),
        default_threshold=float(os.getenv("MIRAGE_DEFAULT_THRESHOLD", "0.35")),
        review_threshold=float(os.getenv("MIRAGE_REVIEW_THRESHOLD", "0.35")),
        match_top_k=max(1, int(os.getenv("MIRAGE_MATCH_TOP_K", "5"))),
        match_margin=float(os.getenv("MIRAGE_MATCH_MARGIN", "0.06")),
        match_workers=max(1, int(os.getenv("MIRAGE_MATCH_WORKERS", "8"))),
        anchor_workers=max(1, int(os.getenv("MIRAGE_ANCHOR_WORKERS", "2"))),
        image_workers=max(1, int(os.getenv("MIRAGE_IMAGE_WORKERS", "2"))),
        anchor_batch_size=max(1, int(os.getenv("MIRAGE_ANCHOR_BATCH_SIZE", "12"))),
        job_batch_size=max(1, int(os.getenv("MIRAGE_JOB_BATCH_SIZE", "50"))),
        poll_interval_seconds=max(1, int(os.getenv("MIRAGE_POLL_INTERVAL_SECONDS", "20"))),
        insightface_model=insightface_model,
        model_version=os.getenv("MIRAGE_MODEL_VERSION", insightface_model),
        preprocessing_version=os.getenv("MIRAGE_PREPROCESSING_VERSION", "face_preprocess_v1"),
        detection_size=max(320, int(os.getenv("MIRAGE_DETECTION_SIZE", "1280"))),
        detection_threshold=float(os.getenv("MIRAGE_DETECTION_THRESHOLD", "0.5")),
        quality_threshold=float(os.getenv("MIRAGE_QUALITY_THRESHOLD", "0.8")),
        onnx_providers=providers,
        google_application_credentials=google_creds,
        required_anchor_count=max(1, int(os.getenv("MIRAGE_REQUIRED_ANCHOR_COUNT", "6"))),
        processor_host=os.getenv("MIRAGE_PROCESSOR_HOST", "127.0.0.1"),
        processor_port=int(os.getenv("MIRAGE_PROCESSOR_PORT", "8765")),
        processor_allowed_origins=_load_processor_allowed_origins(),
        processor_token=os.getenv("MIRAGE_PROCESSOR_TOKEN") or None,
        ops_backend_url=os.getenv("MIRAGE_OPS_BACKEND_URL", "https://ascent.scaler.com").strip(),
        ops_admin_username=os.getenv("MIRAGE_OPS_ADMIN_USERNAME") or None,
        ops_admin_password=os.getenv("MIRAGE_OPS_ADMIN_PASSWORD") or None,
    )
