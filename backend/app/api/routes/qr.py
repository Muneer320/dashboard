from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.qr import QRScanRequest, QRScanResponse
from app.services.event_service import get_event
from app.services.qr_service import scan_college_entry, scan_event_entry, scan_food
from app.services.user_service import get_user_by_id

router = APIRouter()


@router.post("/scan", response_model=QRScanResponse)
async def scan_qr(
    payload: QRScanRequest,
    session: AsyncSession = Depends(get_db_session),
    scanner: User = Depends(get_current_user),
) -> QRScanResponse:
    allowed_roles = {"scanner", "admin", "superAdmin", "eventManage", "EM"}
    if scanner.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Scanner role required")

    target_user = await get_user_by_id(session, payload.user_id)

    if payload.mode == "collegeEntry":
        message = await scan_college_entry(session, target_user)
        status_text = "accepted" if "marked" in message.lower() else "rejected"
        return QRScanResponse(message=message, status=status_text)

    if payload.mode == "food":
        if not payload.meal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Meal is required in food mode")
        message = await scan_food(session, target_user, payload.meal)
        status_text = "accepted" if "marked" in message.lower() else "rejected"
        return QRScanResponse(message=message, status=status_text)

    if not payload.event_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="event_id is required in event mode")

    event = await get_event(session, payload.event_id)
    message = await scan_event_entry(session, target_user, event)
    status_text = "accepted" if "marked" in message.lower() else "rejected"
    return QRScanResponse(message=message, status=status_text)
