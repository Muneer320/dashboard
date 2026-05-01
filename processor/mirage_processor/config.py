import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    data_dir: Path
    default_threshold: float
    match_top_k: int
    match_margin: float
    insightface_model: str
    onnx_providers: list[str]
    google_application_credentials: Path | None


def load_settings() -> Settings:
    load_dotenv()
    missing = [
        name
        for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
        if not os.getenv(name)
    ]

    if missing:
        raise RuntimeError(f"Missing environment variable(s): {', '.join(missing)}")

    providers = [
        provider.strip()
        for provider in os.getenv("MIRAGE_ONNXRUNTIME_PROVIDERS", "CPUExecutionProvider").split(",")
        if provider.strip()
    ]

    creds_raw = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    google_creds = Path(creds_raw).expanduser() if creds_raw else None

    return Settings(
        supabase_url=os.environ["SUPABASE_URL"],
        supabase_service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        data_dir=Path(os.getenv("MIRAGE_PROCESSOR_DATA_DIR", "processor/data")),
        default_threshold=float(os.getenv("MIRAGE_DEFAULT_THRESHOLD", "0.42")),
        match_top_k=max(1, int(os.getenv("MIRAGE_MATCH_TOP_K", "5"))),
        match_margin=float(os.getenv("MIRAGE_MATCH_MARGIN", "0.08")),
        insightface_model=os.getenv("MIRAGE_INSIGHTFACE_MODEL", "buffalo_l"),
        onnx_providers=providers,
        google_application_credentials=google_creds,
    )
