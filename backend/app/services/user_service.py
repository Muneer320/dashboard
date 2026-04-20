import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user_by_id(session: AsyncSession, user_id: str) -> User:
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from exc

    result = await session.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def update_user_profile(session: AsyncSession, user: User, payload: dict) -> User:
    if payload.get("name") is not None:
        user.name = payload["name"]

    if payload.get("details") is not None:
        user.details = payload["details"]

    if payload.get("is_profile_complete") is not None:
        user.is_profile_complete = payload["is_profile_complete"]

    await session.commit()
    await session.refresh(user)
    return user


def get_user_events_payload(user: User) -> dict:
    return {
        "user_id": str(user.id),
        "events": user.events or {},
    }
