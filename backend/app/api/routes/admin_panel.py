from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_only, get_admin_or_em, get_current_admin, get_scanner_or_above
from app.db.session import get_db_session
from app.models.admin import Admin
from app.schemas.admin_panel import (
    EventManagerCreate,
    EventManagerItem,
    EventManagerResponse,
    EventManagerUpdate,
    EventStatsItem,
    MyEventItem,
    ParticipantItem,
    RestrictRequest,
    RestrictResponse,
    StatsResponse,
)
from app.services.admin_panel_service import (
    create_event_manager,
    delete_event_manager,
    get_event_managers,
    get_events_with_stats,
    get_my_events,
    get_overview_stats,
    get_participants_list,
    lookup_participant,
    restrict_participant,
    update_event_manager,
)

router = APIRouter()


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
async def overview_stats(
    session: AsyncSession = Depends(get_db_session),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> StatsResponse:
    """
    Global stat cards.
    admin       → aggregated across all events
    eventManager → aggregated across assigned events only
    """
    data = await get_overview_stats(session, admin)
    return StatsResponse(**data)


@router.get("/events/stats", response_model=list[EventStatsItem])
async def events_stats(
    session: AsyncSession = Depends(get_db_session),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> list[EventStatsItem]:
    """
    Per-event breakdown row for the Overview events table.
    admin       → all events
    eventManager → assigned events only
    """
    rows = await get_events_with_stats(session, admin)
    return [EventStatsItem(**r) for r in rows]


# ── Participants ───────────────────────────────────────────────────────────────

@router.get("/participants", response_model=list[ParticipantItem])
async def participants_list(
    event_id: str | None = None,
    search: str | None = None,
    status: str | None = None,
    session: AsyncSession = Depends(get_db_session),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> list[ParticipantItem]:
    """
    Participants table with optional filters.
    Query params: event_id, search (name/username), status (active|restricted)
    """
    rows = await get_participants_list(session, admin, event_id, search, status)
    return [ParticipantItem(**r) for r in rows]


@router.patch(
    "/participants/{user_id}/restrict",
    response_model=RestrictResponse,
)
async def restrict_user(
    user_id: str,
    body: RestrictRequest,
    session: AsyncSession = Depends(get_db_session),
    admin: Admin = Depends(get_current_admin),
) -> RestrictResponse:
    """
    Restrict or restore a participant for a specific event.
    eventManager must own the event; Scanner cannot call this.
    Body: { event_id, restricted: bool }
    """
    data = await restrict_participant(
        session, admin, user_id, body.event_id, body.restricted
    )
    return RestrictResponse(**data)


# ── Scanner / Lookup ──────────────────────────────────────────────────────────

@router.get("/participants/lookup", response_model=list[ParticipantItem])
async def participant_lookup(
    user_id: str | None = None,
    q: str | None = None,
    event_id: str | None = None,
    session: AsyncSession = Depends(get_db_session),
    admin: Admin = Depends(get_scanner_or_above),   # Scanner, EM, and admin
) -> list[ParticipantItem]:
    """
    Look up a participant by user_id (from QR) or by name/username (q).
    Returns a list — name searches may surface multiple matches.
    Requires scanner, eventManager, or admin JWT.
    """
    rows = await lookup_participant(session, admin, user_id, q, event_id)
    return [ParticipantItem(**r) for r in rows]


# ── My Events ─────────────────────────────────────────────────────────────────

@router.get("/my-events", response_model=list[MyEventItem])
async def my_events(
    session: AsyncSession = Depends(get_db_session),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> list[MyEventItem]:
    """
    Events with full participant list.
    admin       → all events
    eventManager → assigned events only
    """
    rows = await get_my_events(session, admin)
    return [MyEventItem(**r) for r in rows]


# ── Contact Info ──────────────────────────────────────────────────────────────

@router.get("/event-managers", response_model=list[EventManagerItem])
async def event_managers(
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> list[EventManagerItem]:
    """
    All eventManager accounts with contact info and assigned events.
    Admin role only.
    """
    rows = await get_event_managers(session)
    return [EventManagerItem(**r) for r in rows]


@router.post("/event-managers", response_model=EventManagerResponse, status_code=201)
async def create_em(
    body: EventManagerCreate,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> EventManagerResponse:
    """
    Create a new event manager account.
    Provide username, name, password, mail, and optionally phone + events list.
    Returns 409 if username or mail already exists.
    Admin role only.
    """
    data = await create_event_manager(
        session,
        username=body.username,
        name=body.name,
        password=body.password,
        mail=body.mail,
        phone=body.phone,
        events=body.events,
    )
    return EventManagerResponse(**data)


@router.patch("/event-managers/{uid}", response_model=EventManagerResponse)
async def update_em(
    uid: int,
    body: EventManagerUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> EventManagerResponse:
    """
    Update an event manager's profile or reassign their events.
    All body fields are optional — only provided fields are changed.
    Send events=[...] to fully replace the assigned events list.
    Admin role only.
    """
    data = await update_event_manager(
        session,
        uid=uid,
        name=body.name,
        mail=body.mail,
        phone=body.phone,
        events=body.events,
    )
    return EventManagerResponse(**data)


@router.delete("/event-managers/{uid}", response_model=EventManagerResponse)
async def delete_em(
    uid: int,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> EventManagerResponse:
    """
    Remove an event manager account.

    Blocked (409) if this EM is the sole manager of any event.
    Assign a replacement first, then retry.
    Admin role only.
    """
    data = await delete_event_manager(session, uid)
    return EventManagerResponse(**data)
