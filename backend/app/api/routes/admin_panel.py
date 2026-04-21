from fastapi import APIRouter, Depends
from supabase import AsyncClient

from app.api.deps import get_admin_only, get_admin_or_em, get_current_admin, get_scanner_or_above
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.schemas.admin_panel import (
    EventManagerCreate,
    EventManagerItem,
    EventManagerResponse,
    EventManagerUpdate,
    EventStatsItem,
    MealEntryResponse,
    MealsConfigResponse,
    MealsConfigUpdate,
    MyEventItem,
    ParticipantItem,
    RestrictRequest,
    RestrictResponse,
    StatsResponse,
    UserMealsResponse,
)
from app.services.admin_panel_service import (
    create_event_manager,
    delete_event_manager,
    get_event_managers,
    get_events_with_stats,
    get_meals_config,
    get_my_events,
    get_overview_stats,
    get_participants_list,
    list_user_meals,
    lookup_participant,
    restrict_participant,
    set_user_meal_entry,
    update_event_manager,
    update_meals_config,
)

router = APIRouter()


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
async def overview_stats(
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> StatsResponse:
    """
    Global stat cards.
    admin       → aggregated across all events
    eventManager → aggregated across assigned events only
    """
    data = await get_overview_stats(supabase, admin)
    return StatsResponse(**data)


@router.get("/events/stats", response_model=list[EventStatsItem])
async def events_stats(
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> list[EventStatsItem]:
    """
    Per-event breakdown row for the Overview events table.
    admin       → all events
    eventManager → assigned events only
    """
    rows = await get_events_with_stats(supabase, admin)
    return [EventStatsItem(**r) for r in rows]


# ── Participants ───────────────────────────────────────────────────────────────

@router.get("/participants", response_model=list[ParticipantItem])
async def participants_list(
    event_id: str | None = None,
    search: str | None = None,
    status: str | None = None,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> list[ParticipantItem]:
    """
    Participants table with optional filters.
    Query params: event_id, search (name/username), status (active|restricted)
    """
    rows = await get_participants_list(supabase, admin, event_id, search, status)
    return [ParticipantItem(**r) for r in rows]


@router.patch(
    "/participants/{user_id}/restrict",
    response_model=RestrictResponse,
)
async def restrict_user(
    user_id: str,
    body: RestrictRequest,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_current_admin),
) -> RestrictResponse:
    """
    Restrict or restore a participant for a specific event.
    eventManager must own the event; Scanner cannot call this.
    Body: { event_id, restricted: bool }
    """
    data = await restrict_participant(
        supabase, admin, user_id, body.event_id, body.restricted
    )
    return RestrictResponse(**data)


# ── Scanner / Lookup ──────────────────────────────────────────────────────────

@router.get("/participants/lookup", response_model=list[ParticipantItem])
async def participant_lookup(
    user_id: str | None = None,
    q: str | None = None,
    event_id: str | None = None,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_scanner_or_above),   # Scanner, EM, and admin
) -> list[ParticipantItem]:
    """
    Look up a participant by user_id (from QR) or by name/username (q).
    Returns a list — name searches may surface multiple matches.
    Requires scanner, eventManager, or admin JWT.
    """
    rows = await lookup_participant(supabase, admin, user_id, q, event_id)
    return [ParticipantItem(**r) for r in rows]


# ── My Events ─────────────────────────────────────────────────────────────────

@router.get("/my-events", response_model=list[MyEventItem])
async def my_events(
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),  # Scanner blocked
) -> list[MyEventItem]:
    """
    Events with full participant list.
    admin       → all events
    eventManager → assigned events only
    """
    rows = await get_my_events(supabase, admin)
    return [MyEventItem(**r) for r in rows]


# ── Contact Info ──────────────────────────────────────────────────────────────

@router.get("/event-managers", response_model=list[EventManagerItem])
async def event_managers(
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[EventManagerItem]:
    """
    All eventManager accounts with contact info and assigned events.
    Admin role only.
    """
    rows = await get_event_managers(supabase)
    return [EventManagerItem(**r) for r in rows]


@router.post("/event-managers", response_model=EventManagerResponse, status_code=201)
async def create_em(
    body: EventManagerCreate,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> EventManagerResponse:
    """
    Create a new event manager account.
    Provide username, name, password, mail, and optionally phone + events list.
    Returns 409 if username or mail already exists.
    Admin role only.
    """
    data = await create_event_manager(
        supabase,
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
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> EventManagerResponse:
    """
    Update an event manager's profile or reassign their events.
    All body fields are optional — only provided fields are changed.
    Send events=[...] to fully replace the assigned events list.
    Admin role only.
    """
    data = await update_event_manager(
        supabase,
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
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> EventManagerResponse:
    """
    Remove an event manager account.

    Blocked (409) if this EM is the sole manager of any event.
    Assign a replacement first, then retry.
    Admin role only.
    """
    data = await delete_event_manager(supabase, uid)
    return EventManagerResponse(**data)


# ── Meals management ──────────────────────────────────────────────────────────

@router.get("/meals", response_model=MealsConfigResponse)
async def meals_config(
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MealsConfigResponse:
    """
    Current festival-wide meals_count (default 3).
    Admin role only — this is a global config.
    """
    data = await get_meals_config(supabase)
    return MealsConfigResponse(**data)


@router.patch("/meals", response_model=MealsConfigResponse)
async def update_meals(
    body: MealsConfigUpdate,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MealsConfigResponse:
    """
    Change the festival-wide meals_count (1..20).
    Admin role only.
    """
    data = await update_meals_config(supabase, body.meals_count)
    return MealsConfigResponse(**data)


@router.get("/meals/users", response_model=UserMealsResponse)
async def user_meals(
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> UserMealsResponse:
    """
    Per-user meals claim matrix: meals_count + every user's claimed/unclaimed
    status for meal1..mealN. Admin role only.
    """
    data = await list_user_meals(supabase)
    return UserMealsResponse(**data)


@router.post(
    "/meals/users/{user_id}/{meal_id}",
    response_model=MealEntryResponse,
    status_code=201,
)
async def add_user_meal(
    user_id: str,
    meal_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MealEntryResponse:
    """
    Manually mark a user's meal as claimed (e.g., if QR scan failed).
    Adds (or overwrites) user.food[meal_id] = True.
    Admin role only.
    """
    data = await set_user_meal_entry(supabase, user_id, meal_id, claimed=True)
    return MealEntryResponse(**data)


@router.delete(
    "/meals/users/{user_id}/{meal_id}",
    response_model=MealEntryResponse,
)
async def remove_user_meal(
    user_id: str,
    meal_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MealEntryResponse:
    """
    Remove a user's meal claim entirely (pops the key from users.food).
    Admin role only.
    """
    data = await set_user_meal_entry(supabase, user_id, meal_id, claimed=False)
    return MealEntryResponse(**data)
