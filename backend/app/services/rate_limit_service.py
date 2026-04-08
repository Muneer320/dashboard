from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rate_limit import RateLimitEntry


async def allow_rate_limited_action(
    session: AsyncSession,
    rate_key: str,
    limit: int,
    window_seconds: int,
) -> bool:
    now = datetime.now(timezone.utc)
    window = timedelta(seconds=window_seconds)

    result = await session.execute(select(RateLimitEntry).where(RateLimitEntry.rate_key == rate_key))
    entry = result.scalar_one_or_none()

    if entry is None:
        entry = RateLimitEntry(rate_key=rate_key, request_count=1, window_started_at=now)
        session.add(entry)
        await session.commit()
        return True

    if now - entry.window_started_at >= window:
        entry.request_count = 1
        entry.window_started_at = now
        session.add(entry)
        await session.commit()
        return True

    if entry.request_count >= limit:
        return False

    entry.request_count += 1
    session.add(entry)
    await session.commit()
    return True


async def cleanup_expired_rate_limits(session: AsyncSession, window_seconds: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    result = await session.execute(
        delete(RateLimitEntry).where(RateLimitEntry.window_started_at < cutoff)
    )
    await session.commit()
    return getattr(result, "rowcount", 0) or 0
