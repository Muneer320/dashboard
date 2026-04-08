from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User


async def login_with_credentials(session: AsyncSession, username: str, password: str) -> str:
    result = await session.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return create_access_token(subject=str(user.id))


async def register_user(
    session: AsyncSession,
    username: str,
    password: str,
    name: str,
    unstop_id: str | None = None,
) -> User:
    existing_username = await session.execute(select(User).where(User.username == username))
    if existing_username.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Username already exists")

    if unstop_id:
        existing_unstop = await session.execute(select(User).where(User.unstop_id == unstop_id))
        if existing_unstop.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Unstop user already exists")

    user = User(
        username=username,
        password_hash=get_password_hash(password),
        name=name,
        unstop_id=unstop_id,
        details={},
        events={},
        food={"meal1": False, "meal2": False, "meal3": False},
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
