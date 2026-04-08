from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.unstop import UnstopSyncRequest, UnstopSyncResponse
from app.services.event_service import set_event_phase_state
from app.services.unstop_service import sync_unstop_users

router = APIRouter()


@router.post("/unstop/sync", response_model=UnstopSyncResponse)
async def sync_unstop(
    payload: UnstopSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UnstopSyncResponse:
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    result = await sync_unstop_users(session, payload.users)
    return UnstopSyncResponse(**result)


@router.post("/events/{event_id}/phases/{phase}/activate")
async def activate_event_phase(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    event = await set_event_phase_state(session, event_id, phase, is_active=True, is_locked=False)
    return {"message": "Phase activated", "event_id": str(event.id), "phase": phase}


@router.post("/events/{event_id}/phases/{phase}/lock")
async def lock_event_phase(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    event = await set_event_phase_state(session, event_id, phase, is_locked=True)
    return {"message": "Phase locked", "event_id": str(event.id), "phase": phase}


@router.post("/events/{event_id}/phases/{phase}/unlock")
async def unlock_event_phase(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    event = await set_event_phase_state(session, event_id, phase, is_locked=False)
    return {"message": "Phase unlocked", "event_id": str(event.id), "phase": phase}
