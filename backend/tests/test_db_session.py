from app.db.session import _normalize_async_database_url


def test_normalize_plain_postgres_url_to_asyncpg() -> None:
    url = _normalize_async_database_url(
        "postgresql://archive:archive-local-only@127.0.0.1:5432/archive_demo")
    assert url.startswith("postgresql+asyncpg://")


def test_preserve_asyncpg_url() -> None:
    url = _normalize_async_database_url(
        "postgresql+asyncpg://archive:archive-local-only@127.0.0.1:5432/archive_demo")
    assert url.startswith("postgresql+asyncpg://postgres:")
    assert url.endswith("@localhost:5432/ascent")
