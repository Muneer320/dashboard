from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.api.deps import get_scanner_or_above
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.schemas.qr import QRScanRequest, QRScanResponse
from app.services.event_service import get_event
from app.services.qr_service import scan_college_entry, scan_event_entry, scan_food
from app.services.user_service import get_user_by_id

router = APIRouter()


@router.post("/scan", response_model=QRScanResponse)
async def scan_qr(
    payload: QRScanRequest,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_scanner_or_above),  # scanner, eventManager, or admin only
) -> QRScanResponse:
    target_user = await get_user_by_id(supabase, payload.user_id)

    if payload.mode == "collegeEntry":
        message = await scan_college_entry(supabase, target_user)
        status_text = "accepted" if "marked" in message.lower() else "rejected"
        return QRScanResponse(message=message, status=status_text)

    if payload.mode == "food":
        if not payload.meal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meal is required in food mode",
            )
        message = await scan_food(supabase, target_user, payload.meal)
        status_text = "accepted" if "marked" in message.lower() else "rejected"
        return QRScanResponse(message=message, status=status_text)

    if not payload.event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="event_id is required in event mode",
        )

    event = await get_event(supabase, payload.event_id)
    message = await scan_event_entry(supabase, target_user, event)
    status_text = "accepted" if "marked" in message.lower() else "rejected"
    return QRScanResponse(message=message, status=status_text)
