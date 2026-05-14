import asyncio
import csv
import io
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from supabase import AsyncClient
from fastapi_cache.decorator import cache

# Maximum accepted upload size (10 MB).
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Only keep alphanumerics, hyphens, and underscores in the output filename.
_SAFE_FILENAME_RE = re.compile(r"[^\w\-]")

from app.api.deps import get_admin_only, get_admin_or_em, get_current_admin, get_scanner_or_above
from app.db.supabase_client import first_row, get_supabase
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
    ManualEnrollRequest,
    ManualEnrollResponse,
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
from app.schemas.mirage import (
    MirageAnchorUserItem,
    MirageFaceMatchReviewRequest,
    MirageFaceMatchReviewResponse,
    MirageJobCreateRequest,
    MirageJobDetailResponse,
    MirageJobImageReviewRequest,
    MirageJobImageReviewResponse,
    MirageJobListItem,
    MirageJobStatusResponse,
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
    manual_enroll,
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
from app.services.mirage_pipeline_service import (
    approve_mirage_job,
    create_mirage_job,
    delete_mirage_job,
    get_mirage_job_detail,
    list_mirage_anchor_users,
    list_mirage_jobs,
    publish_mirage_job,
    update_mirage_face_match_review,
    update_mirage_job_image_review,
)
from app.services.announcement_service import list_announcements
from app.services.cache_service import auth_aware_cache_key_builder

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


# ── Manual single-participant entry ────────────────────────────────────────────────────

@router.post("/registrations/manual", response_model=ManualEnrollResponse, status_code=201)
async def manual_registration(
    body: ManualEnrollRequest,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> ManualEnrollResponse:
    """
    Manually add a single participant to an event.

    - Creates the user account if the email is new (password is hashed server-side).
    - Adds the event to an existing user's registrations (409 if already enrolled).
    - team_mode: 'none' | 'existing' | 'new'
    Admin role only.
    """
    data = await manual_enroll(
        supabase,
        name=body.name,
        email=body.email,
        plain_password=body.password,
        event_id=body.event_id,
        team_mode=body.team_mode,
        existing_team_name=body.existing_team_name,
        existing_member_name=body.existing_member_name,
        new_team_name=body.new_team_name,
    )
    return ManualEnrollResponse(**data)


# ── Select Participants (phase = 1) ───────────────────────────────────────────

class _SelectPhaseBody(BaseModel):
    event_id: str
    emails: list[str]


@router.post("/registrations/select-phase")
async def select_phase(
    body: _SelectPhaseBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
):
    """
    Given a list of emails and an event_id, set phase = 1 inside
    ``users.events[event_id]`` for each user found and registered.

    Returns:
        {
          "updated":    <int>,
          "edge_cases": [{"email": ..., "reason": ...}, ...]
        }

    Edge-case reasons:
      - "User not found"
      - "Not registered for this event"
    """
    updated    = 0
    edge_cases = []

    # Normalise emails once
    normalised = [e.strip().lower() for e in body.emails if e.strip()]

    if not normalised:
        return {"updated": 0, "edge_cases": []}

    # Fetch all matching users in one query (username = email in this system)
    try:
        resp = await (
            supabase.table("users")
            .select("id, username, events")
            .in_("username", normalised)
            .execute()
        )
        db_rows = resp.data if resp.data is not None else []
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {exc}",
        )

    # Index by normalised username for O(1) lookup
    found = {
        r["username"].strip().lower(): r
        for r in db_rows
        if isinstance(r.get("username"), str)
    }

    for email in normalised:
        row = found.get(email)
        if not row:
            edge_cases.append({"email": email, "reason": "User not found"})
            continue

        events_col: dict = row.get("events") or {}
        if not isinstance(events_col, dict) or body.event_id not in events_col:
            edge_cases.append({"email": email, "reason": "Not registered for this event"})
            continue

        # Safely copy event entry — guard against None / non-dict values in production
        raw_entry = events_col[body.event_id]
        event_entry = dict(raw_entry) if isinstance(raw_entry, dict) else {}
        event_entry["phase"] = 1
        events_col[body.event_id] = event_entry

        try:
            await (
                supabase.table("users")
                .update({"events": events_col})
                .eq("id", row["id"])
                .execute()
            )
            updated += 1
        except Exception as exc:
            edge_cases.append({"email": email, "reason": f"Update failed: {exc}"})

    return {"updated": updated, "edge_cases": edge_cases}


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
@cache(expire=60, key_builder=auth_aware_cache_key_builder)
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
@cache(expire=60, key_builder=auth_aware_cache_key_builder)
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


# ── Meals count — must be BEFORE /{event_id} wildcard ────────────────────────

@router.get("/events/meals-count", response_model=list[EventMealsItem])
async def list_events_meals(
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),
) -> list[EventMealsItem]:
    """
    Per-event meals_count list.
    admin       → all events
    eventManager → assigned events only
    NOTE: must stay above /events/{event_id} or FastAPI will shadow it.
    """
    rows = await get_events_meals_counts(supabase, admin)
    return [EventMealsItem(**r) for r in rows]


# ── Submissions CSV Download ──────────────────────────────────────────────────

@router.get("/events/{event_id}/submissions/download")
async def download_event_submissions(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),
):
    """
    Download a CSV of all submissions for a single event.

    Layout:
    - Columns: Name, Email, Team ID, Phase, Submitted At, <question_id…>
    - Rows with submissions come first (one row per phase submitted).
    - Participants who registered but never submitted are appended at the
      bottom with "not submitted" in every answer column.

    admin → any event; eventManager → assigned events only.
    """
    from app.services.admin_panel_service import (
        _all_events_lean,
        _all_users_lean,
        _get_scoped_event_ids,
        _has_any_submission,
    )

    all_events, all_users = await asyncio.gather(
        _all_events_lean(supabase),
        _all_users_lean(supabase),
    )
    all_event_ids = [str(e.id) for e in all_events]
    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))

    if event_id not in scoped_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this event",
        )

    event = next((e for e in all_events if str(e.id) == event_id), None)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # ── Fetch Team Names ──────────────────────────────────────────────────────
    teams_resp = await (
        supabase.table("teams")
        .select("id, name")
        .eq("event_id", event_id)
        .execute()
    )
    team_name_map = {str(r["id"]): r["name"] for r in teams_resp.data}

    # ── Pass 1: Group users by team and collect submissions / questions ───────
    # We do a single scan so the column headers are stable regardless of which
    # team/phase we see first.
    class TeamData:
        def __init__(self, t_id: str, t_name: str):
            self.id = t_id
            self.name = t_name
            self.members = []
            self.submissions = {}

    teams_map: dict[str, TeamData] = {}
    ordered_question_ids: list[str] = []
    seen_question_ids: set[str] = set()

    for user in all_users:
        entry = (user.events or {}).get(event_id)
        if entry is None:
            continue  # not registered for this event

        team_id = entry.get("teamId")
        if team_id:
            group_key = team_id
            team_name = team_name_map.get(team_id, f"Team {team_id[:8]}")
        else:
            group_key = f"solo_{user.id}"
            team_name = "Solo Participant"

        if group_key not in teams_map:
            teams_map[group_key] = TeamData(team_id or "", team_name)

        teams_map[group_key].members.append(user)

        submission = entry.get("submission")
        has_sub = _has_any_submission(entry)

        if has_sub and isinstance(submission, dict):
            for phase_key, phase_data in submission.items():
                if not isinstance(phase_data, dict) or not phase_data.get("submitted"):
                    continue
                
                if phase_key not in teams_map[group_key].submissions:
                    teams_map[group_key].submissions[phase_key] = phase_data

                for ans in phase_data.get("answers") or []:
                    qid = ans.get("question_id", "")
                    if qid and qid not in seen_question_ids:
                        seen_question_ids.add(qid)
                        ordered_question_ids.append(qid)

    # ── Pass 2: build CSV rows ────────────────────────────────────────────────
    fixed_headers = ["Team Name", "Team ID"]
    for i in range(1, 5):
        fixed_headers.extend([f"Member {i} Name", f"Member {i} Email", f"Member {i} Phone"])
    fixed_headers.extend(["Phase", "Submitted At"])
    
    all_headers = fixed_headers + ordered_question_ids

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(all_headers)

    for team in teams_map.values():
        member_cols = []
        for i in range(4):
            if i < len(team.members):
                u = team.members[i]
                phone = (u.details or {}).get("phone", "")
                member_cols.extend([u.name, u.username, phone])
            else:
                member_cols.extend(["", "", ""])
                
        base_row = [team.name, team.id] + member_cols

        if team.submissions:
            for phase_key, phase_data in team.submissions.items():
                answer_map: dict[str, str] = {}
                for ans in phase_data.get("answers") or []:
                    qid = ans.get("question_id", "")
                    raw_val = ans.get("answer", "")
                    answer_map[qid] = str(raw_val) if raw_val is not None else ""

                row = base_row + [
                    phase_key,
                    phase_data.get("submitted_at") or "",
                ] + [answer_map.get(qid, "") for qid in ordered_question_ids]

                writer.writerow(row)
        else:
            row = base_row + [
                "",  # phase
                "not submitted",
            ] + ["not submitted"] * len(ordered_question_ids)
            writer.writerow(row)

    output.seek(0)

    safe_event_name = _SAFE_FILENAME_RE.sub("_", event.name)[:40]
    filename = f"Ascent_{safe_event_name}_Submissions_{event_id[:8]}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


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
    """Soft-deactivate an admin account. Admin role only."""
    data = await delete_admin_user(supabase, uid, current_admin.uid)
    return AdminUserResponse(**data)


@router.post("/admin-users/{uid}/restore", response_model=AdminUserResponse)
async def restore_admin(
    uid: int,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> AdminUserResponse:
    """Reactivate a previously deactivated admin account. Admin role only."""
    resp = await (
        supabase.table("admins")
        .select("*")
        .eq("uid", uid)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(404, "Admin not found")
    await supabase.table("admins").update({"deleted_at": None}).eq("uid", uid).execute()
    return AdminUserResponse(
        uid=row["uid"], username=row["username"], name=row["name"],
        role=row["role"], phone=row.get("phone"), mail=row["mail"],
        events=row.get("events") or [],
        message="Admin restored successfully",
    )


# ── Meals management ──────────────────────────────────────────────────────────
#
# meals_count lives on ``events`` now — one slot count per event, summed across
# a user's registered events to form their total allowance. QR scans
# auto-assign the next slot; admins can still toggle slots here manually.




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


@router.get("/mirage/jobs", response_model=list[MirageJobListItem])
async def admin_list_mirage_jobs(
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[MirageJobListItem]:
    items = await list_mirage_jobs(supabase)
    return [MirageJobListItem(**item) for item in items]


@router.get("/mirage/users", response_model=list[MirageAnchorUserItem])
async def admin_list_mirage_users(
    pending_only: bool = True,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[MirageAnchorUserItem]:
    items = await list_mirage_anchor_users(supabase, pending_only=pending_only)
    return [MirageAnchorUserItem(**item) for item in items]


@router.post("/mirage/jobs", response_model=MirageJobListItem, status_code=201)
async def admin_create_mirage_job(
    body: MirageJobCreateRequest,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MirageJobListItem:
    item = await create_mirage_job(supabase, body.model_dump())
    return MirageJobListItem(**item)


@router.get("/mirage/jobs/{job_id}", response_model=MirageJobDetailResponse)
async def admin_get_mirage_job(
    job_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MirageJobDetailResponse:
    item = await get_mirage_job_detail(supabase, job_id)
    return MirageJobDetailResponse(**item)


@router.delete("/mirage/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_mirage_job(
    job_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_only),
) -> Response:
    await delete_mirage_job(supabase, admin, job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/mirage/job-images/{job_image_id}", response_model=MirageJobImageReviewResponse)
async def admin_patch_mirage_job_image(
    job_image_id: str,
    body: MirageJobImageReviewRequest,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_only),
) -> MirageJobImageReviewResponse:
    item = await update_mirage_job_image_review(
        supabase,
        admin,
        job_image_id,
        body.model_dump(exclude_unset=True),
    )
    return MirageJobImageReviewResponse(**item)


@router.patch("/mirage/matches/{match_id}", response_model=MirageFaceMatchReviewResponse)
async def admin_patch_mirage_match(
    match_id: str,
    body: MirageFaceMatchReviewRequest,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_only),
) -> MirageFaceMatchReviewResponse:
    item = await update_mirage_face_match_review(
        supabase,
        admin,
        match_id,
        body.model_dump(exclude_unset=True),
    )
    return MirageFaceMatchReviewResponse(**item)


@router.post("/mirage/jobs/{job_id}/approve", response_model=MirageJobStatusResponse)
async def admin_approve_mirage_job(
    job_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MirageJobStatusResponse:
    item = await approve_mirage_job(supabase, job_id)
    return MirageJobStatusResponse(**item)


@router.post("/mirage/jobs/{job_id}/publish", response_model=MirageJobStatusResponse)
async def admin_publish_mirage_job(
    job_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> MirageJobStatusResponse:
    item = await publish_mirage_job(supabase, job_id)
    return MirageJobStatusResponse(**item)
