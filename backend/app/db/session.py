from collections.abc import AsyncGenerator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _normalize_async_database_url(database_url: str) -> str:
    url = make_url(database_url)
    backend = url.get_backend_name()
    if "+asyncpg" not in url.drivername:
        url = url.set(drivername=f"{backend}+asyncpg")
    return str(url)


engine = create_async_engine(_normalize_async_database_url(
    settings.DATABASE_URL), pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
