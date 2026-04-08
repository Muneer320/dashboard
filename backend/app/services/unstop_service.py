import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import AccessLevel, User, UserRole
from app.schemas.unstop import UnstopUserItem


VALID_ACCESS_LEVELS = {level.value for level in AccessLevel}


async def sync_unstop_users(session: AsyncSession, users: list[UnstopUserItem]) -> dict:
    created_credentials: list[dict[str, str]] = []
    created_count = 0
    updated_count = 0

    for incoming in users:
        if incoming.access_level not in VALID_ACCESS_LEVELS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Invalid access level for {incoming.username}")

        result = await session.execute(
            select(User).where((User.unstop_id == incoming.unstop_id)
                               | (User.username == incoming.username))
        )
        user = result.scalar_one_or_none()
        if user is None:
            temporary_password = secrets.token_urlsafe(10)
            user = User(
                unstop_id=incoming.unstop_id,
                username=incoming.username,
                password_hash=get_password_hash(temporary_password),
                name=incoming.name,
                details=incoming.details,
                events={},
                food={"meal1": False, "meal2": False, "meal3": False},
                access_level=AccessLevel(incoming.access_level),
                role=UserRole.USER,
                is_profile_complete=incoming.is_profile_complete,
            )
            session.add(user)
            created_count += 1
            created_credentials.append(
                {
                    "unstop_id": incoming.unstop_id,
                    "username": incoming.username,
                    "temporary_password": temporary_password,
                }
            )
            continue

        user.unstop_id = incoming.unstop_id
        user.name = incoming.name
        user.details = incoming.details
        user.access_level = AccessLevel(incoming.access_level)
        user.is_profile_complete = incoming.is_profile_complete
        updated_count += 1

    await session.commit()

    return {
        "created": created_count,
        "updated": updated_count,
        "created_credentials": created_credentials,
    }
