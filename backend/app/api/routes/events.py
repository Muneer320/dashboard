from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.event import EventParticipantsResponse, EventRegisterResponse, EventResponse
from app.services.event_service import get_event, get_event_participants_payload, list_events, register_for_event

router = APIRouter()


@router.get("", response_model=list[EventResponse])
async def get_events(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> list[EventResponse]:
    events = await list_events(session)
    return [
        EventResponse(
            id=str(event.id),
            name=event.name,
            description=event.description,
            venue=event.venue or [],
            rounds=event.rounds or {},
            participants_count=len(event.participants or {}),
        )
        for event in events
    ]


@router.get("/{event_id}", response_model=EventResponse)
async def get_single_event(
    event_id: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> EventResponse:
    event = await get_event(session, event_id)
    return EventResponse(
        id=str(event.id),
        name=event.name,
        description=event.description,
        venue=event.venue or [],
        rounds=event.rounds or {},
        participants_count=len(event.participants or {}),
    )


@router.post("/{event_id}/register", response_model=EventRegisterResponse)
async def register_event(
    event_id: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EventRegisterResponse:
    event = await get_event(session, event_id)
    await register_for_event(session, current_user, event)
    return EventRegisterResponse(message="Registration successful", event_id=str(event.id), user_id=str(current_user.id))


@router.get("/{event_id}/participants", response_model=EventParticipantsResponse)
async def get_event_participants(
    event_id: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EventParticipantsResponse:
    if current_user.role.value not in {"admin", "scanner"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Admin or scanner role required")

    event = await get_event(session, event_id)
    payload = get_event_participants_payload(event)
    return EventParticipantsResponse(**payload)
