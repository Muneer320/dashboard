from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.unstop import UnstopSyncRequest, UnstopSyncResponse
from app.services.unstop_service import sync_unstop_users

router = APIRouter()


@router.post("/unstop/sync", response_model=UnstopSyncResponse)
async def sync_unstop(
    payload: UnstopSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UnstopSyncResponse:
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    result = await sync_unstop_users(session, payload.users)
    return UnstopSyncResponse(**result)
