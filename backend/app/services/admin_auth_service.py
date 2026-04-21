from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.models.admin import Admin


async def admin_login(session: AsyncSession, username: str, password: str) -> str:
    """Authenticate against the admins table and return a JWT with role embedded."""
    result = await session.execute(select(Admin).where(Admin.username == username))
    admin = result.scalar_one_or_none()

    if admin is None or not verify_password(password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    # JWT subject is prefixed with "admin:" so deps can distinguish user vs admin tokens
    return create_access_token(
        subject=f"admin:{admin.uid}",
        role=admin.role.value,
    )
