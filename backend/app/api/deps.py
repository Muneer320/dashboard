import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenError, decode_access_token
from app.db.session import get_db_session
from app.models.admin import Admin
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Roles allowed to perform scanning / gate management
_SCANNER_ROLES = {"Scanner", "eventManager", "admin"}


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str = Depends(oauth2_scheme),
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid token payload") from exc

    result = await session.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_current_admin(
    session: AsyncSession = Depends(get_db_session),
    token: str = Depends(oauth2_scheme),
) -> Admin:
    """Dependency that requires an admin JWT (issued via POST /auth/admin/login)."""
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub", "")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not sub.startswith("admin:"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin credentials required",
        )

    try:
        admin_uid = int(sub.split("admin:", 1)[1])
    except (ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        ) from exc

    result = await session.execute(select(Admin).where(Admin.uid == admin_uid))
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    return admin


async def get_scanner_or_above(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Requires scanner, eventManager, or admin role."""
    if admin.role.value not in _SCANNER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scanner, Event Manager, or Admin role required",
        )
    return admin


async def get_admin_only(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Requires admin role only."""
    if admin.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return admin


async def get_admin_or_em(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """
    Requires admin or eventManager role.
    Scanner is explicitly blocked — they have no data-read access beyond lookup.
    """
    if admin.role.value not in {"admin", "eventManager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Event Manager role required",
        )
    return admin
