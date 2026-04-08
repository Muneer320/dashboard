import asyncio

from app.db.base import Base
from app.db.session import engine
from app.models import Event, User  # noqa: F401


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def run() -> None:
    asyncio.run(init_db())
