from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

    PROJECT_NAME: str = "Ascent Dashboard Backend"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://archive:archive-local-only@127.0.0.1:5432/archive_demo"

    JWT_SECRET_KEY: str = "change-this-in-env"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    FILE_SIGNING_SECRET: str = "change-this-file-secret"
    UPLOAD_ROOT: str = "uploads"

    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_STORAGE_BUCKET: str = "submissions"
    SUPABASE_SIGNED_URL_EXPIRES_SECONDS: int = 604800

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
