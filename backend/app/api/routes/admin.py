from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_only
from app.db.session import get_db_session
from app.models.admin import Admin
from app.schemas.unstop import UnstopSyncRequest, UnstopSyncResponse
from app.services.event_service import set_event_phase_state
from app.services.unstop_service import sync_unstop_users

router = APIRouter()


@router.post("/unstop/sync", response_model=UnstopSyncResponse)
async def sync_unstop(
    payload: UnstopSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> UnstopSyncResponse:
    result = await sync_unstop_users(session, payload.users)
    return UnstopSyncResponse(**result)


@router.post("/events/{event_id}/phases/{phase}/activate")
async def activate_event_phase(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> dict:
    event = await set_event_phase_state(session, event_id, phase, is_active=True, is_locked=False)
    return {"message": "Phase activated", "event_id": str(event.id), "phase": phase}


@router.post("/events/{event_id}/phases/{phase}/lock")
async def lock_event_phase(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> dict:
    event = await set_event_phase_state(session, event_id, phase, is_locked=True)
    return {"message": "Phase locked", "event_id": str(event.id), "phase": phase}


@router.post("/events/{event_id}/phases/{phase}/unlock")
async def unlock_event_phase(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> dict:
    event = await set_event_phase_state(session, event_id, phase, is_locked=False)
    return {"message": "Phase unlocked", "event_id": str(event.id), "phase": phase}
