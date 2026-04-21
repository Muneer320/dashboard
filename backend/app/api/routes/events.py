from fastapi import APIRouter, Depends
from supabase import AsyncClient

from app.api.deps import get_current_user, get_scanner_or_above
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.models.user import User
from app.schemas.event import EventParticipantsResponse, EventRegisterResponse, EventResponse
from app.schemas.team import MyTeamResponse
from app.services.event_service import (
    get_event,
    get_event_participants_payload,
    list_events,
    register_for_event,
)
from app.services.team_service import get_my_team

router = APIRouter()


@router.get("", response_model=list[EventResponse])
async def get_events(
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> list[EventResponse]:
    events = await list_events(supabase)
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
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> EventResponse:
    event = await get_event(supabase, event_id)
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
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> EventRegisterResponse:
    event = await get_event(supabase, event_id)
    await register_for_event(supabase, current_user, event)
    return EventRegisterResponse(
        message="Registration successful",
        event_id=str(event.id),
        user_id=str(current_user.id),
    )


@router.get("/{event_id}/participants", response_model=EventParticipantsResponse)
async def get_event_participants(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_scanner_or_above),  # scanner, eventManager, or admin only
) -> EventParticipantsResponse:
    event = await get_event(supabase, event_id)
    payload = get_event_participants_payload(event)
    return EventParticipantsResponse(**payload)


@router.get("/{event_id}/my-team", response_model=MyTeamResponse | None)
async def my_team(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> MyTeamResponse | None:
    """Fetch the calling user's team details for the specified event."""
    data = await get_my_team(supabase, current_user, event_id)
    if data is None:
        return None
    return MyTeamResponse(**data)
