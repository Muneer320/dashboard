from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.api.deps import get_scanner_or_above
from app.db.supabase_client import get_supabase
from app.models.admin import Admin, AdminRole
from app.schemas.qr import QRScanRequest, QRScanResponse
from app.services.event_service import get_event
from app.services.qr_service import scan_college_entry, scan_event_entry, scan_food
from app.services.user_service import get_user_by_id

router = APIRouter()


def _assert_event_in_scope(admin: Admin, event_id: str) -> None:
    """
    Event-manager may only scan attendance for events they manage.
    Admin and Scanner pass through unchanged.
    """
    if admin.role != AdminRole.EVENT_MANAGER:
        return
    assigned = {str(e) for e in (admin.events or [])}
    if event_id not in assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not manage this event",
        )


@router.post("/scan", response_model=QRScanResponse)
async def scan_qr(
    payload: QRScanRequest,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_scanner_or_above),  # scanner, eventManager, or admin only
) -> QRScanResponse:
    target_user = await get_user_by_id(supabase, payload.user_id)

    if payload.mode == "collegeEntry":
        message = await scan_college_entry(supabase, target_user)
        status_text = "accepted" if "marked" in message.lower() else "rejected"
        return QRScanResponse(message=message, status=status_text)

    if payload.mode == "food":
        # Meal slot is auto-assigned by the backend based on the user's
        # remaining allowance; payload.meal (if sent) is ignored.
        message = await scan_food(supabase, target_user)
        status_text = "accepted" if "marked" in message.lower() else "rejected"
        return QRScanResponse(message=message, status=status_text)

    # Event-attendance mode
    if not payload.event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="event_id is required in event mode",
        )

    # Enforce event-manager scope before touching the DB.
    _assert_event_in_scope(admin, payload.event_id)

    event = await get_event(supabase, payload.event_id)
    message = await scan_event_entry(supabase, target_user, event)
    status_text = "accepted" if "marked" in message.lower() else "rejected"
    return QRScanResponse(message=message, status=status_text)
