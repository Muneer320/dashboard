from fastapi import APIRouter, Depends
from fastapi_cache.decorator import cache
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase
from app.models.user import User
from app.schemas.event import EventRegisterResponse, EventResponse
from app.schemas.team import MyTeamResponse
from app.services.event_service import (
    get_event,
    get_event_registration_counts,
    list_events,
    register_for_event,
)
from app.services.team_service import get_my_team

router = APIRouter()


def _build_event_response(event, participants_count: int) -> EventResponse:
    return EventResponse(
        id=str(event.id),
        name=event.name,
        title=event.title or "",
        description=event.description,
        venue=event.venue or [],
        rounds=event.rounds or {},
        participants_count=participants_count,
        community_link=event.community_link,
    )


@router.get("", response_model=list[EventResponse])
@cache(expire=120)
async def get_events(
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> list[EventResponse]:
    events = await list_events(supabase)
    counts = await get_event_registration_counts(supabase, [str(event.id) for event in events])
    return [_build_event_response(event, counts.get(str(event.id), 0)) for event in events]


@router.get("/public", response_model=list[EventResponse])
@cache(expire=120)
async def get_public_events(
    supabase: AsyncClient = Depends(get_supabase),
) -> list[EventResponse]:
    events = await list_events(supabase)
    counts = await get_event_registration_counts(supabase, [str(event.id) for event in events])
    return [_build_event_response(event, counts.get(str(event.id), 0)) for event in events]


@router.get("/{event_id}", response_model=EventResponse)
async def get_single_event(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> EventResponse:
    event = await get_event(supabase, event_id)
    counts = await get_event_registration_counts(supabase, [str(event.id)])
    return _build_event_response(event, counts.get(str(event.id), 0))


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


# /events/{event_id}/participants endpoint removed — events.participants column dropped.
# Use the admin-panel /participants endpoint which queries users.events instead.


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
