"""
Rating service — submit and read per-event ratings.
Upserts on (user_id, event_id) so a user can update their rating any time.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rating import Rating


async def submit_rating(
    session: AsyncSession,
    user_id: str,
    event_id: str,
    value: int,
    feedback: str | None,
) -> dict:
    """
    Create or update a user's rating for an event.
    Returns the saved rating dict.
    """
    user_uuid = uuid.UUID(user_id)
    event_uuid = uuid.UUID(event_id)

    result = await session.execute(
        select(Rating).where(
            Rating.user_id == user_uuid,
            Rating.event_id == event_uuid,
        )
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = Rating(
            user_id=user_uuid,
            event_id=event_uuid,
            value=value,
            feedback=feedback,
        )
        session.add(row)
    else:
        row.value = value
        row.feedback = feedback
        session.add(row)

    await session.commit()
    await session.refresh(row)
    return {
        "event_id": event_id,
        "value": row.value,
        "feedback": row.feedback,
    }


async def get_my_rating(
    session: AsyncSession,
    user_id: str,
    event_id: str,
) -> dict | None:
    """Return the calling user's rating for an event, or None if not rated."""
    result = await session.execute(
        select(Rating).where(
            Rating.user_id == uuid.UUID(user_id),
            Rating.event_id == uuid.UUID(event_id),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return {
        "event_id": event_id,
        "value": row.value,
        "feedback": row.feedback,
    }


async def get_rating_summary(
    session: AsyncSession,
    event_id: str,
) -> dict:
    """Return average star rating and total count for an event."""
    result = await session.execute(
        select(
            func.avg(Rating.value).label("avg"),
            func.count(Rating.id).label("count"),
        ).where(Rating.event_id == uuid.UUID(event_id))
    )
    row = result.one()
    avg_val = float(row.avg) if row.avg is not None else 0.0
    return {
        "event_id": event_id,
        "avg": round(avg_val, 2),
        "count": row.count,
    }
