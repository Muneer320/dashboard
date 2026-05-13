from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    PROJECT_NAME: str = "Ascent Dashboard Backend"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = False

    JWT_SECRET_KEY: str = "change-this-in-env"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Supabase (primary data backend)
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    MIRAGE_SUPABASE_URL: str | None = None
    MIRAGE_SUPABASE_SERVICE_ROLE_KEY: str | None = None
    DATABASE_URL: str | None = None
    MIRAGE_DATABASE_URL: str | None = None
    SUPABASE_STORAGE_BUCKET: str = "submissions"
    SUPABASE_SIGNED_URL_EXPIRES_SECONDS: int = 604800
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    GOOGLE_SERVICE_ACCOUNT_JSON: str | None = None
    MIRAGE_REQUIRED_ANCHOR_COUNT: int = 6
    MIRAGE_MAX_ANCHOR_COUNT: int = 10
    MIRAGE_STORAGE_PREFIX: str = "mirage"
    MIRAGE_MODEL_VERSION: str = "buffalo_l"
    MIRAGE_PREPROCESSING_VERSION: str = "face_preprocess_v1"
    MIRAGE_DEFAULT_THRESHOLD: float = 0.35
    MIRAGE_S3_BUCKET_NAME: str = "ascent-users"
    MIRAGE_S3_REGION: str = "ap-south-1"
    MIRAGE_S3_PUBLIC_BASE_URL: str = "https://ascent-users.s3.ap-south-1.amazonaws.com/"
    MIRAGE_S3_ENDPOINT_URL: str | None = None
    MIRAGE_S3_SIGNED_URL_EXPIRES_SECONDS: int = 3600
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_SESSION_TOKEN: str | None = None

    BACKGROUND_JOB_INTERVAL_SECONDS: int = 300
    UNSTOP_SYNC_SOURCE_JSON: str | None = None

    QR_RATE_LIMIT_PER_MINUTE: int = 10
    QR_RATE_LIMIT_WINDOW_SECONDS: int = 60

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: str | None = None

    @field_validator("DEBUG", mode="before")
    @classmethod
    def _parse_debug(cls, value):  # type: ignore[no-untyped-def]
        # Some deployment environments set DEBUG to strings like "release".
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"release", "prod", "production"}:
                return False
            if lowered in {"debug", "dev", "development"}:
                return True
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
