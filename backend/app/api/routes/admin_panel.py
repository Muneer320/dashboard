import csv
import io
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from supabase import AsyncClient
from fastapi_cache.decorator import cache

# Maximum accepted upload size (10 MB).
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Only keep alphanumerics, hyphens, and underscores in the output filename.
_SAFE_FILENAME_RE = re.compile(r"[^\w\-]")

from app.api.deps import get_admin_only, get_admin_or_em, get_current_admin, get_scanner_or_above
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.schemas.admin_panel import (
    AdminUserCreate,
    AdminUserItem,
    AdminUserResponse,
    AdminUserUpdate,
    EventDetailResponse,
    EventMealsItem,
    EventMealsUpdate,
    EventStatsItem,
    EventUpdateRequest,
    MealEntryResponse,
    MyEventItem,
    ParticipantItem,
    RequestedMemberItem,
    RequestedMemberStatusUpdate,
    RestrictRequest,
    RestrictResponse,
    StatsResponse,
    UserMealsResponse,
)
from app.services.admin_panel_service import (
    create_admin_user,
    delete_admin_user,
    get_admin_users,
    get_event_detail,
    get_events_meals_counts,
    get_events_with_stats,
    get_my_events,
    get_participants_list,
    list_user_meals,
    lookup_participant,
    restrict_participant,
    set_user_meal_entry,
    update_admin_user,
    update_event_details,
    update_event_meals_count,
    get_overview_stats,
)
from app.services.bulk_enroll_service import (
    bulk_enroll,
    find_uncovered_users,
    parse_upload,
    regenerate_passwords_for_ids,
)
from pydantic import BaseModel


class _CoveredEmailsBody(BaseModel):
    emails: list[str] = []


class _RegenerateIdsBody(BaseModel):
    user_ids: list[str] = []
from app.services.credentials_service import (
    list_requested_members,
    update_requested_member_status,
)
from app.services.announcement_service import list_announcements

router = APIRouter()

# ── Bulk Registration ─────────────────────────────────────────────────────────

@router.post("/registrations/upload")
async def handle_bulk_registration(
    event_id: str = Form(...),
    file: UploadFile = File(...),
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
):
    """
    Process an uploaded CSV or XLSX roster for a specific event.
    Returns a generated CSV containing the new users' credentials.
    Admin role only.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large — maximum allowed size is {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
        
    parsed_rows = parse_upload(file.filename, content)
    if not parsed_rows:
        raise HTTPException(status_code=400, detail="No readable rows found in uploaded file")
        
    result = await bulk_enroll(supabase, event_id, parsed_rows)
    
    import json as _json

    # Generate CSV — new users get a password row; existing users get blank password
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Username", "Password", "Event", "Type"])

    for cred in result["new_credentials"]:
        writer.writerow([cred["name"], cred["email"], cred["password"], cred["event"], "new"])

    for existing in result["added_to_existing"]:
        writer.writerow([existing["name"], existing["email"], "", result["event"]["name"], "existing"])

    output.seek(0)

    event_id_val   = result["event"]["id"]
    event_name_val = result["event"]["name"]
    safe_event_name = _SAFE_FILENAME_RE.sub("_", event_name_val)[:40]
    out_filename = f"Ascent_{safe_event_name}_Credentials_{event_id_val[:8]}.csv"

    # Serialise errors_detail as JSON for the frontend (truncated to avoid huge headers)
    errors_json = _json.dumps(result["errors_detail"][:20])

    headers = {
        "Content-Disposition": f"attachment; filename={out_filename}",
        "X-Stats-Created":    str(result["summary"]["created"]),
        "X-Stats-Added":      str(result["summary"]["added_to_existing"]),
        "X-Stats-Duplicates": str(result["summary"]["duplicates"]),
        "X-Stats-Errors":     str(result["summary"]["errors"]),
        "X-Errors-Detail":    errors_json,
        "Access-Control-Expose-Headers": (
            "X-Stats-Created, X-Stats-Added, X-Stats-Duplicates, "
            "X-Stats-Errors, X-Errors-Detail, Content-Disposition"
        ),
    }

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers=headers,
    )


# ── Uncovered users (find DB rows missing from a credentials CSV) ────────────
#
# Workflow on the admin panel:
#   1. Admin uploads a CSV (name, email, password) of users they've already
#      sent credentials to. Frontend extracts the email column and posts the
#      list to /uncovered-users.
#   2. We diff DB usernames against the supplied list and return the gap.
#   3. Admin reviews the list, clicks "Generate passwords & email", which
#      batches user IDs (chunks of ~350 client-side) into the regenerate
#      endpoint below. Each chunk hashes & writes new passwords and returns
#      the plaintext credentials so the frontend's existing Apps-Script
#      mailer can send them.

@router.post("/uncovered-users")
async def post_uncovered_users(
    body: _CoveredEmailsBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
):
    """
    Return DB users whose ``username`` (email) does NOT appear in
    ``body.emails``. Comparison is case-insensitive + whitespace-tolerant.
    """
    return await find_uncovered_users(supabase, body.emails)


@router.post("/uncovered-users/regenerate")
async def post_regenerate_uncovered(
    body: _RegenerateIdsBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
):
    """
    Regenerate passwords for the given user IDs (overwrites password_hash).
    Returns ``[{name, email, password}]`` so the frontend can hand the
    plaintext credentials to the same Apps-Script mailer it already uses
    for new bulk-enrollments. Caller is expected to chunk this from the
    frontend so each request fits inside the proxy timeout.
    """
    return await regenerate_passwords_for_ids(supabase, body.user_ids)


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
@cache(expire=30)
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


# ── Individual Event Detail ────────────────────────────────────────────────────

@router.get("/events/{event_id}", response_model=EventDetailResponse)
async def event_detail(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),
) -> EventDetailResponse:
    """
    Full detail for a single event (with participant list).
    admin → any event; eventManager → assigned events only.
    """
    data = await get_event_detail(supabase, admin, event_id)
    return EventDetailResponse(**data)


@router.patch("/events/{event_id}", response_model=EventDetailResponse)
async def patch_event(
    event_id: str,
    body: EventUpdateRequest,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),
) -> EventDetailResponse:
    """
    Update core event fields.
    admin → any event; eventManager → assigned events only.
    """
    data = await update_event_details(
        supabase, admin, event_id, body.model_dump(exclude_none=True)
    )
    return EventDetailResponse(**data)


# ── Admins ──────────────────────────────────────────────────────────────

@router.get("/admin-users", response_model=list[AdminUserItem])
async def admin_users(
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[AdminUserItem]:
    """
    All admin accounts.
    Admin role only.
    """
    rows = await get_admin_users(supabase)
    return [AdminUserItem(**r) for r in rows]


@router.post("/admin-users", response_model=AdminUserResponse, status_code=201)
async def create_admin(
    body: AdminUserCreate,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> AdminUserResponse:
    """
    Create a new admin account.
    Returns 409 if username or mail already exists.
    Admin role only.
    """
    data = await create_admin_user(
        supabase,
        username=body.username,
        name=body.name,
        role=body.role,
        password=body.password,
        mail=body.mail,
        phone=body.phone,
        events=body.events,
        booth_id=body.booth_id,
    )
    return AdminUserResponse(**data)


@router.patch("/admin-users/{uid}", response_model=AdminUserResponse)
async def update_admin(
    uid: int,
    body: AdminUserUpdate,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> AdminUserResponse:
    """
    Update an admin's profile or reassign their events.
    Admin role only.
    """
    data = await update_admin_user(
        supabase,
        uid=uid,
        name=body.name,
        role=body.role,
        password=body.password,
        mail=body.mail,
        phone=body.phone,
        events=body.events,
        booth_id=body.booth_id,
        # Pydantic v2 — distinguish "field omitted" from "explicit null"
        booth_id_provided="booth_id" in body.model_fields_set,
    )
    return AdminUserResponse(**data)


@router.delete("/admin-users/{uid}", response_model=AdminUserResponse)
async def delete_admin(
    uid: int,
    supabase: AsyncClient = Depends(get_supabase),
    current_admin: Admin = Depends(get_admin_only),
) -> AdminUserResponse:
    """
    Remove an admin account.
    Admin role only.
    """
    data = await delete_admin_user(supabase, uid, current_admin.uid)
    return AdminUserResponse(**data)


# ── Meals management ──────────────────────────────────────────────────────────
#
# meals_count lives on ``events`` now — one slot count per event, summed across
# a user's registered events to form their total allowance. QR scans
# auto-assign the next slot; admins can still toggle slots here manually.


@router.get("/events/meals-count", response_model=list[EventMealsItem])
async def list_events_meals(
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),
) -> list[EventMealsItem]:
    """
    Per-event meals_count list.
    admin       → all events
    eventManager → assigned events only
    """
    rows = await get_events_meals_counts(supabase, admin)
    return [EventMealsItem(**r) for r in rows]


@router.patch("/events/{event_id}/meals-count", response_model=EventMealsItem)
async def patch_event_meals(
    event_id: str,
    body: EventMealsUpdate,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> EventMealsItem:
    """
    Change a single event's meals_count (0..20). Admin role only.
    """
    data = await update_event_meals_count(supabase, event_id, body.meals_count)
    return EventMealsItem(**data)


@router.get("/meals/users", response_model=UserMealsResponse)
async def user_meals(
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> UserMealsResponse:
    """
    Per-user meals claim matrix plus each user's total allowance
    (sum of their registered events' meals_count). Admin role only.
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
    Adds (or overwrites) user.food[meal_id] = True — bounded by the user's
    allowance.
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


# ── Announcements (admin read) ─────────────────────────────────────────────────

@router.get("/announcements")
async def admin_list_announcements(
    limit: int = 100,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[dict]:
    """Return all announcements — admin only, uses admin JWT."""
    return await list_announcements(supabase, limit=limit)


# ── Requested Members (credentials-request review) ────────────────────────────
#
# The public ``POST /credentials-requests`` endpoint writes into the
# ``requested_members`` table. Admins review and approve/reject entries here.
# No eventManager / Scanner access — this is pure admin workflow.


@router.get("/requested-members", response_model=list[RequestedMemberItem])
async def requested_members_list(
    status_filter: str | None = None,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[RequestedMemberItem]:
    """
    All credential requests, newest first.
    Optional ``?status_filter=pending|approved|rejected`` for bucketing.
    Admin role only.
    """
    data = await list_requested_members(supabase, status_filter)
    return [RequestedMemberItem(**r) for r in data]


@router.patch(
    "/requested-members/{request_id}",
    response_model=RequestedMemberItem,
)
async def requested_members_update_status(
    request_id: str,
    body: RequestedMemberStatusUpdate,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> RequestedMemberItem:
    """
    Move a request between pending → approved / rejected (or back to pending
    if the admin changes their mind). Admin role only.
    """
    data = await update_requested_member_status(supabase, request_id, body.status)
    return RequestedMemberItem(**data)
