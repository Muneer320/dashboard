"""
admin_panel_service.py
======================
Business logic for all /admin-panel/* endpoints. Supabase-backed.

Scoping rules
-------------
  admin        -> sees / can modify everything
  eventManager -> scoped to event IDs listed in admin.events JSONB
  Scanner      -> no data-read access (403) except lookup_participant
"""

from __future__ import annotations

import asyncio
import re
import time
import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.security import get_password_hash
from app.db.supabase_client import first_row, rows
from app.models.admin import Admin, AdminRole
from app.models.event import DEFAULT_EVENT_MEALS_COUNT, Event
from app.models.user import User


_MEAL_KEY_RE = re.compile(r"^meal(\d+)$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_scoped_event_ids(
    admin: Admin,
    all_event_ids: list[str],
    *,
    allow_scanner: bool = False,
) -> list[str]:
    """
    Return the list of event IDs this admin may act on.

    Raises 403 for Scanner role unless allow_scanner is True
    (used for lookup_participant so scanners can search).
    """
    if admin.role == AdminRole.ADMIN:
        return all_event_ids

    if admin.role == AdminRole.EVENT_MANAGER:
        assigned: list[str] = [str(e) for e in (admin.events or [])]
        return [eid for eid in all_event_ids if eid in assigned]

    # Scanner
    if allow_scanner:
        return all_event_ids

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied -- insufficient role",
    )


def _parse_user_uuid(user_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        ) from exc


def _parse_event_uuid(event_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(event_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format",
        ) from exc


def _has_any_submission(entry: dict) -> bool:
    """
    Return True if the user has at least one completed phase submission for
    this event entry.

    New shape:  entry['submission'] = { 'phase1': { 'submitted': True, ... }, ... }
    Legacy shapes (bool / None / old link-pair object) are treated as False.
    """
    sub = entry.get("submission")
    if not isinstance(sub, dict):
        return False
    return any(
        isinstance(phase_data, dict) and bool(phase_data.get("submitted"))
        for phase_data in sub.values()
    )


def _build_participant_dict(
    user: User,
    event_id: str,
    event_name: str,
    entry: dict,
    team_members_map: dict[str, list[str]] | None = None,
) -> dict:
    """Build the ParticipantItem dict from a user + one event entry."""
    food = user.food or {}
    sub = entry.get("submission")
    team_id = entry.get("teamId")
    member_ids: list[str] = []
    if team_id and team_members_map:
        member_ids = team_members_map.get(team_id, [])
    return {
        "id": str(user.id),
        "name": user.name,
        "username": user.username,
        "eventId": event_id,
        "eventName": event_name,
        "teamId": team_id,
        "teamMemberIds": member_ids,
        "status": "restricted" if entry.get("restricted") else "active",
        "isAttending": bool(entry.get("isAttending", False)),
        "foodClaimed": any(food.values()),
        "entryScanned": bool(user.is_attending),
        "submitted": _has_any_submission(entry),
        "submissionData": sub if isinstance(sub, dict) else None,
    }


# ---------------------------------------------------------------------------
# Column sets — lean queries omit heavy JSONB blobs
# ---------------------------------------------------------------------------

# events: excludes `participants` (can be MB-scale per event)
_EVENTS_LEAN_COLS = (
    "id,name,category,start_date,end_date,venue,"
    "max_participants,meals_count,community_link,rules,judges,rounds,questions"
)

# users: excludes `password_hash`, `unstop_id`, `is_profile_complete`,
# `cents`, timestamps — only what aggregation code actually reads
_USERS_LEAN_COLS = "id,name,username,is_attending,events,food,details"


_PAGE_SIZE = 1000  # Supabase default max per request


async def _fetch_all(supabase: AsyncClient, table: str, cols: str = "*") -> list[dict]:
    """Paginate a Supabase table query to bypass the 1 000-row default limit."""
    all_rows: list[dict] = []
    offset = 0
    while True:
        resp = await (
            supabase.table(table)
            .select(cols)
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        page = rows(resp)
        all_rows.extend(page)
        if len(page) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return all_rows


async def _all_events(supabase: AsyncClient) -> list[Event]:
    """Full event rows including participants — only for write paths that mutate participants."""
    return [Event.from_row(r) for r in await _fetch_all(supabase, "events")]


# ---------------------------------------------------------------------------
# In-process memory cache  (avoids repeated round-trips to Supabase)
# ---------------------------------------------------------------------------
# The free Supabase plan enforces a short statement timeout. By caching the
# full table results in RAM for _LEAN_TTL seconds, subsequent requests within
# that window return instantly without touching the DB.

_LEAN_CACHE: dict[str, tuple[float, list]] = {}
_LEAN_CACHE_TTL = 30  # seconds


async def _cached_lean(key: str, fetcher, ttl: float = _LEAN_CACHE_TTL):
    """Read-through cache with TTL. Dict writes are GIL-safe in CPython."""
    now = time.monotonic()
    cached = _LEAN_CACHE.get(key)
    if cached and now - cached[0] < ttl:
        return cached[1]
    data = await fetcher()
    _LEAN_CACHE[key] = (now, data)
    return data


def _invalidate_lean_cache() -> None:
    """Bust the cache after any mutation so next read sees fresh data."""
    _LEAN_CACHE.clear()


async def _all_events_lean(supabase: AsyncClient) -> list[Event]:
    """Event rows WITHOUT the participants JSONB — cached for _LEAN_CACHE_TTL s."""
    async def _fetch():
        return [Event.from_row(r) for r in await _fetch_all(supabase, "events", _EVENTS_LEAN_COLS)]
    return await _cached_lean("events_lean", _fetch)


async def _all_users_lean(supabase: AsyncClient) -> list[User]:
    """User rows without heavy columns — cached for _LEAN_CACHE_TTL s."""
    async def _fetch():
        return [User.from_row(r) for r in await _fetch_all(supabase, "users", _USERS_LEAN_COLS)]
    return await _cached_lean("users_lean", _fetch)



# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def get_overview_stats(supabase: AsyncClient, admin: Admin) -> dict:
    """Aggregate stats cards for the Overview tab."""
    all_events, all_users = await asyncio.gather(
        _all_events_lean(supabase),
        _all_users_lean(supabase),
    )
    all_event_ids = [str(e.id) for e in all_events]
    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))

    registered_ids: set[str] = set()
    attending = 0
    restricted = 0
    submitted = 0
    entry_scanned = 0
    food_claimed = 0
    submitted_teams_seen: set[tuple[str, str]] = set()
    registered_teams_seen: set[tuple[str, str]] = set()  # (eid, team_id)

    for user in all_users:
        user_events: dict = user.events or {}
        user_in_scope = False

        for eid, entry in user_events.items():
            if eid not in scoped_ids:
                continue
            user_in_scope = True
            team_id = entry.get("teamId")
            if team_id:
                registered_teams_seen.add((eid, str(team_id)))
            if entry.get("isAttending"):
                attending += 1
            if entry.get("restricted"):
                restricted += 1
            if _has_any_submission(entry):
                if team_id:
                    key = (eid, str(team_id))
                    if key not in submitted_teams_seen:
                        submitted_teams_seen.add(key)
                        submitted += 1
                else:
                    submitted += 1

        if user_in_scope:
            registered_ids.add(str(user.id))
            if user.is_attending:
                entry_scanned += 1
            food = user.food or {}
            if any(food.values()):
                food_claimed += 1

    return {
        "totalRegistered": len(registered_ids),
        "totalTeams": len(registered_teams_seen),
        "attending": attending,
        "restricted": restricted,
        "foodClaimed": food_claimed,
        "entryScanned": entry_scanned,
        "submitted": submitted,
        "submittedTeams": submitted,
        "eventCount": len(scoped_ids),
    }


async def get_events_with_stats(
    supabase: AsyncClient, admin: Admin
) -> list[dict]:
    """Per-event stat rows for the Overview events breakdown table."""
    all_events, all_users = await asyncio.gather(
        _all_events_lean(supabase),
        _all_users_lean(supabase),
    )
    all_event_ids = [str(e.id) for e in all_events]
    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))
    scoped_events = [e for e in all_events if str(e.id) in scoped_ids]

    result: list[dict] = []
    for event in scoped_events:
        eid = str(event.id)
        registered = attended = submitted_count = restricted_count = 0
        submitted_teams_seen: set[str] = set()
        registered_teams: set[str] = set()

        for user in all_users:
            entry = (user.events or {}).get(eid)
            if entry is None:
                continue
            registered += 1
            team_id = entry.get("teamId")
            if team_id:
                registered_teams.add(str(team_id))
            if entry.get("isAttending"):
                attended += 1
            if _has_any_submission(entry):
                if team_id:
                    if str(team_id) not in submitted_teams_seen:
                        submitted_teams_seen.add(str(team_id))
                        submitted_count += 1
                else:
                    submitted_count += 1
            if entry.get("restricted"):
                restricted_count += 1

        result.append({
            "id": eid,
            "name": event.name,
            "title": event.title or "",
            "category": event.category or "Other",
            "date": event.start_date.date().isoformat() if event.start_date else None,
            "venue": event.venue or [],
            "maxParticipants": event.max_participants,
            "registered": registered,
            "teams": len(registered_teams),
            "attended": attended,
            "submitted": submitted_count,
            "submittedTeams": submitted_count,
            "restricted": restricted_count,
            "communityLink": event.community_link,
        })

    return result


async def get_participants_list(
    supabase: AsyncClient,
    admin: Admin,
    event_id: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
) -> list[dict]:
    """Participants table with optional filters."""
    all_events, all_users, team_rows = await asyncio.gather(
        _all_events_lean(supabase),
        _all_users_lean(supabase),
        _fetch_all(supabase, "teams"),
    )
    all_event_ids = [str(e.id) for e in all_events]
    event_name_map = {str(e.id): e.name for e in all_events}

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))

    if event_id is not None:
        if event_id not in scoped_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this event",
            )
        scoped_ids = {event_id}

    team_members_map: dict[str, list[str]] = {
        str(t["id"]): [str(m) for m in (t.get("member_ids") or [])]
        for t in team_rows
    }

    result: list[dict] = []
    for user in all_users:
        if search:
            s = search.lower()
            if s not in user.name.lower() and s not in user.username.lower():
                continue

        user_events: dict = user.events or {}

        for eid, entry in user_events.items():
            if eid not in scoped_ids:
                continue

            is_restricted = bool(entry.get("restricted", False))

            if status_filter == "restricted" and not is_restricted:
                continue
            if status_filter == "active" and is_restricted:
                continue

            result.append(
                _build_participant_dict(user, eid, event_name_map.get(eid, ""), entry, team_members_map)
            )

    return result


async def restrict_participant(
    supabase: AsyncClient,
    admin: Admin,
    user_id: str,
    event_id: str,
    restricted: bool,
) -> dict:
    """
    Set or clear user.events[event_id]["restricted"].
    eventManager must own the event.
    """
    if admin.role == AdminRole.EVENT_MANAGER:
        assigned = [str(e) for e in (admin.events or [])]
        if event_id not in assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not manage this event",
            )
    elif admin.role == AdminRole.SCANNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scanner role cannot restrict participants",
        )

    user_uuid = _parse_user_uuid(user_id)
    user_resp = await (
        supabase.table("users")
        .select("*")
        .eq("id", str(user_uuid))
        .limit(1)
        .execute()
    )
    user_row = first_row(user_resp)
    if user_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = User.from_row(user_row)

    user_events: dict = user.events or {}
    if event_id not in user_events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not registered for this event",
        )

    user_events[event_id]["restricted"] = restricted
    await (
        supabase.table("users")
        .update({"events": user_events})
        .eq("id", str(user.id))
        .execute()
    )

    return {"user_id": user_id, "event_id": event_id, "restricted": restricted}


async def lookup_participant(
    supabase: AsyncClient,
    admin: Admin,
    user_id: str | None = None,
    q: str | None = None,
    event_id: str | None = None,
) -> list[dict]:
    """
    Search for participants. Used by Scanner tab.
    Scanners are allowed here (allow_scanner=True).
    Returns a list so name-search can surface multiple matches.
    """
    all_events = await _all_events_lean(supabase)
    all_event_ids = [str(e.id) for e in all_events]
    event_name_map = {str(e.id): e.name for e in all_events}

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids, allow_scanner=True))

    if event_id is not None:
        scoped_ids = {event_id} if event_id in scoped_ids else set()

    users: list[User] = []

    if user_id is not None:
        user_uuid = _parse_user_uuid(user_id)
        resp = await (
            supabase.table("users")
            .select("*")
            .eq("id", str(user_uuid))
            .limit(1)
            .execute()
        )
        row = first_row(resp)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found."
            )
        users = [User.from_row(row)]

    elif q:
        pattern = f"%{q}%"
        try:
            resp = await (
                supabase.table("users")
                .select("*")
                .or_(f"name.ilike.{pattern},username.ilike.{pattern}")
                .execute()
            )
            found = rows(resp)
        except Exception:
            # Fallback: paginated full-table scan
            all_rows = await _fetch_all(supabase, "users")
            needle = q.lower()
            found = [
                r
                for r in all_rows
                if needle in (r.get("name") or "").lower()
                or needle in (r.get("username") or "").lower()
            ]
        if not found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found."
            )
        users = [User.from_row(r) for r in found]

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide user_id or q query parameter",
        )

    result: list[dict] = []
    # Pre-fetch teams for member_ids lookup
    team_rows = await _fetch_all(supabase, "teams")
    team_members_map: dict[str, list[str]] = {
        str(t["id"]): [str(m) for m in (t.get("member_ids") or [])]
        for t in team_rows
    }
    for user in users:
        for eid, entry in (user.events or {}).items():
            if eid not in scoped_ids:
                continue
            result.append(
                _build_participant_dict(user, eid, event_name_map.get(eid, ""), entry, team_members_map)
            )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found."
        )

    return result


async def get_my_events(supabase: AsyncClient, admin: Admin) -> list[dict]:
    """Events with full participant list for My Events tab."""
    all_events, all_users, _team_rows = await asyncio.gather(
        _all_events_lean(supabase),
        _all_users_lean(supabase),
        _fetch_all(supabase, "teams"),
    )
    all_event_ids = [str(e.id) for e in all_events]
    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))
    scoped_events = [e for e in all_events if str(e.id) in scoped_ids]
    team_members_map: dict[str, list[str]] = {
        str(t["id"]): [str(m) for m in (t.get("member_ids") or [])]
        for t in _team_rows
    }

    result: list[dict] = []
    for event in scoped_events:
        eid = str(event.id)
        participants: list[dict] = []
        registered = attended = submitted_count = 0
        submitted_teams_seen: set[str] = set()
        registered_teams: set[str] = set()

        for user in all_users:
            entry = (user.events or {}).get(eid)
            if entry is None:
                continue

            registered += 1
            team_id = entry.get("teamId")
            if team_id:
                registered_teams.add(str(team_id))
            is_submitted = _has_any_submission(entry)
            is_attending = bool(entry.get("isAttending", False))
            if is_submitted:
                if team_id:
                    if str(team_id) not in submitted_teams_seen:
                        submitted_teams_seen.add(str(team_id))
                        submitted_count += 1
                else:
                    submitted_count += 1
            if is_attending:
                attended += 1

            participants.append({
                "id": str(user.id),
                "name": user.name,
                "teamId": entry.get("teamId"),
                "teamMemberIds": team_members_map.get(entry.get("teamId") or "", []),
                "status": "restricted" if entry.get("restricted") else "active",
                "submitted": is_submitted,
                "isAttending": is_attending,
            })

        result.append({
            "id": eid,
            "name": event.name,
            "title": event.title or "",
            "venue": event.venue or [],
            "date": event.start_date.isoformat() if event.start_date else None,
            "maxParticipants": event.max_participants,
            "registered": registered,
            "teams": len(registered_teams),
            "submitted": submitted_count,
            "submittedTeams": submitted_count,
            "attended": attended,
            "participants": participants,
            "communityLink": event.community_link,
        })

    return result


async def get_admin_users(supabase: AsyncClient) -> list[dict]:
    """All admin rows -- admin-only Admins tab."""
    resp = await (
        supabase.table("admins")
        .select("*")
        .execute()
    )
    managers = [Admin.from_row(r) for r in rows(resp)]
    return [
        {
            "uid": m.uid,
            "username": m.username,
            "name": m.name,
            "role": m.role.value,
            "phone": m.phone,
            "mail": m.mail,
            "events": m.events or [],
        }
        for m in managers
    ]


async def create_admin_user(
    supabase: AsyncClient,
    username: str,
    name: str,
    role: str,
    password: str,
    mail: str | None,
    phone: str | None,
    events: list[str],
) -> dict:
    """
    Create a new Admin row.
    Raises 409 if username or mail is already taken.
    """
    u_resp = await (
        supabase.table("admins")
        .select("uid")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    if first_row(u_resp) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{username}' is already taken",
        )

    if mail:
        m_resp = await (
            supabase.table("admins")
            .select("uid")
            .eq("mail", mail)
            .limit(1)
            .execute()
        )
        if first_row(m_resp) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{mail}' is already registered",
            )

    payload = {
        "role": role,
        "username": username,
        "name": name,
        "password_hash": get_password_hash(password),
        "mail": mail,
        "phone": phone,
        "events": events,
    }
    insert_resp = await (
        supabase.table("admins")
        .insert(payload)
        .execute()
    )
    row = first_row(insert_resp) or {**payload, "uid": None}

    return {
        "uid": row.get("uid"),
        "username": row["username"],
        "name": row["name"],
        "role": row["role"],
        "phone": row.get("phone"),
        "mail": row["mail"],
        "events": row.get("events") or [],
        "message": "Admin created successfully",
    }


async def update_admin_user(
    supabase: AsyncClient,
    uid: int,
    name: str | None,
    role: str | None,
    password: str | None,
    mail: str | None,
    phone: str | None,
    events: list[str] | None,
) -> dict:
    """
    Update an admin's profile fields.
    Only fields provided (non-None) are changed.
    """
    resp = await (
        supabase.table("admins")
        .select("*")
        .eq("uid", uid)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    patch: dict = {}
    if name is not None:
        patch["name"] = name
    if role is not None:
        patch["role"] = role
    if password is not None and password.strip():
        patch["password_hash"] = get_password_hash(password)
    if mail is not None:
        if mail:
            conflict = await (
                supabase.table("admins")
                .select("uid")
                .eq("mail", mail)
                .neq("uid", uid)
                .limit(1)
                .execute()
            )
            if first_row(conflict) is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Email '{mail}' is already registered",
                )
        patch["mail"] = mail
    if phone is not None:
        patch["phone"] = phone
    if events is not None:
        patch["events"] = events

    if patch:
        update_resp = await (
            supabase.table("admins")
            .update(patch)
            .eq("uid", uid)
            .execute()
        )
        updated = first_row(update_resp) or {**row, **patch}
    else:
        updated = row

    return {
        "uid": updated["uid"],
        "username": updated["username"],
        "name": updated["name"],
        "role": updated["role"],
        "phone": updated.get("phone"),
        "mail": updated["mail"],
        "events": updated.get("events") or [],
        "message": "Admin updated successfully",
    }

async def delete_admin_user(supabase: AsyncClient, uid: int, current_admin_uid: int) -> dict:
    """
    Remove an admin account.
    """
    if uid == current_admin_uid:
        raise HTTPException(status_code=409, detail="Cannot delete your own account")

    resp = await (
        supabase.table("admins")
        .select("*")
        .eq("uid", uid)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    # Prevent deleting the last admin
    if row["role"] == AdminRole.ADMIN.value:
        admins_resp = await supabase.table("admins").select("uid").eq("role", AdminRole.ADMIN.value).execute()
        if len(rows(admins_resp)) <= 1:
            raise HTTPException(status_code=409, detail="Cannot delete the last super admin")

    await supabase.table("admins").delete().eq("uid", uid).execute()
    
    return {
        "uid": row["uid"],
        "username": row["username"],
        "name": row["name"],
        "role": row["role"],
        "phone": row.get("phone"),
        "mail": row["mail"],
        "events": row.get("events") or [],
        "message": "Admin deleted successfully",
    }


# ── Meals ─────────────────────────────────────────────────────────────────────
#
# Model: ``events.meals_count`` holds how many meal slots each event contributes
# to a registered user's allowance. A user's total allowance is the sum of
# ``meals_count`` across every event they're registered for. ``users.food`` is
# a JSONB dict of ``{"meal1": True, "meal2": True, …}`` populated as slots get
# claimed. The QR scanner auto-assigns the next slot; admins can still add or
# remove entries manually here.


def _parse_meal_index(meal_id: str) -> int:
    m = _MEAL_KEY_RE.match(meal_id or "")
    if not m:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid meal key '{meal_id}' — expected 'meal1', 'meal2', …",
        )
    return int(m.group(1))


def _event_meals_count(event: Event) -> int:
    """Read a dataclass Event's meals_count with a sensible default."""
    raw = event.meals_count
    return int(raw if raw is not None else DEFAULT_EVENT_MEALS_COUNT)


async def get_events_meals_counts(supabase: AsyncClient, admin: Admin) -> list[dict]:
    """
    Return the per-event meals_count list for the Meals admin tab.
    admin      → all events
    eventManager → assigned events only (they don't strictly need this
    endpoint yet, but scoping keeps parity with the rest of the panel).
    """
    all_events = await _all_events_lean(supabase)
    all_event_ids = [str(e.id) for e in all_events]
    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))
    scoped_events = [e for e in all_events if str(e.id) in scoped_ids]

    return [
        {
            "id": str(e.id),
            "name": e.name,
            "meals_count": _event_meals_count(e),
        }
        for e in sorted(scoped_events, key=lambda e: e.name.lower())
    ]


async def update_event_meals_count(
    supabase: AsyncClient,
    event_id: str,
    meals_count: int,
) -> dict:
    """
    Change a single event's meals_count. Admin-only (route enforces).
    Validates 0..20 — 0 is a valid value for events that don't serve meals.
    """
    if meals_count < 0 or meals_count > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="meals_count must be between 0 and 20",
        )

    event_uuid = _parse_event_uuid(event_id)
    resp = await (
        supabase.table("events")
        .select("id, name")
        .eq("id", str(event_uuid))
        .limit(1)
        .execute()
    )
    if first_row(resp) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    update_resp = await (
        supabase.table("events")
        .update({"meals_count": meals_count})
        .eq("id", str(event_uuid))
        .execute()
    )
    updated = first_row(update_resp) or {}
    return {
        "id": str(event_uuid),
        "name": updated.get("name") or first_row(resp)["name"],
        "meals_count": int(updated.get("meals_count", meals_count)),
    }


async def list_user_meals(supabase: AsyncClient) -> dict:
    """
    Per-user meals matrix:
      - Each user's allowance = sum(events.meals_count) over their registered events.
      - ``claimed`` = number of True entries currently in ``users.food``.
      - ``claims`` expands to meal1..meal{allowance} with claimed flags (absent
        keys → False) so the admin UI can still toggle any slot up to the cap.

    Also returns the global cap (``max_meals_count`` = sum of every event's
    meals_count) so the UI can size its table safely for the power-user case.
    """
    all_events, all_users = await asyncio.gather(
        _all_events_lean(supabase),
        _all_users_lean(supabase),
    )

    event_meal_map: dict[str, int] = {
        str(e.id): _event_meals_count(e) for e in all_events
    }
    max_meals_count = sum(event_meal_map.values())

    users_payload: list[dict] = []
    for user in sorted(all_users, key=lambda u: u.name.lower()):
        food = user.food or {}
        allowance = 0
        for eid in (user.events or {}).keys():
            allowance += event_meal_map.get(str(eid), 0)

        claimed_count = sum(1 for v in food.values() if v)

        claims: list[dict] = []
        for i in range(1, allowance + 1):
            mid = f"meal{i}"
            claims.append({"meal_id": mid, "claimed": bool(food.get(mid))})

        users_payload.append({
            "user_id": str(user.id),
            "name": user.name,
            "username": user.username,
            "allowance": allowance,
            "claimed": claimed_count,
            "claims": claims,
        })

    return {
        "max_meals_count": max_meals_count,
        "users": users_payload,
    }


async def set_user_meal_entry(
    supabase: AsyncClient,
    user_id: str,
    meal_id: str,
    claimed: bool,
) -> dict:
    """
    Manually add or remove a meal claim for a user.

    ``claimed=True``  → sets user.food[meal_id] = True (respects their
    allowance — can't manually grant more than they're entitled to).
    ``claimed=False`` → removes the meal_id key from user.food entirely so
    the row doesn't carry stale keys around.
    """
    idx = _parse_meal_index(meal_id)

    user_uuid = _parse_user_uuid(user_id)
    user_resp = await (
        supabase.table("users")
        .select("*")
        .eq("id", str(user_uuid))
        .limit(1)
        .execute()
    )
    row = first_row(user_resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user = User.from_row(row)

    # Compute allowance from their registered events (same logic as scan_food).
    allowance = 0
    user_event_ids = list((user.events or {}).keys())
    if user_event_ids:
        ev_resp = await (
            supabase.table("events")
            .select("id, meals_count")
            .in_("id", user_event_ids)
            .execute()
        )
        for ev in rows(ev_resp):
            raw = ev.get("meals_count")
            allowance += int(raw if raw is not None else DEFAULT_EVENT_MEALS_COUNT)

    if claimed and idx > allowance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Meal '{meal_id}' exceeds the user's allowance "
                f"({allowance}). Raise an event's meals_count or register "
                f"them for another event first."
            ),
        )

    food = dict(user.food or {})

    if claimed:
        if food.get(meal_id):
            message = "Meal already claimed — no change"
        else:
            food[meal_id] = True
            message = "Meal entry added"
    else:
        if meal_id in food:
            food.pop(meal_id, None)
            message = "Meal entry removed"
        else:
            message = "No existing meal entry — nothing to remove"

    await (
        supabase.table("users")
        .update({"food": food})
        .eq("id", str(user.id))
        .execute()
    )

    return {
        "user_id": str(user.id),
        "meal_id": meal_id,
        "claimed": bool(food.get(meal_id, False)),
        "message": message,
    }


# ── Event manager management ──────────────────────────────────────────────────

async def delete_event_manager(supabase: AsyncClient, uid: int) -> dict:
    """
    Delete an eventManager account.

    Blocked (409) if this EM is the sole manager of any event.
    """
    resp = await (
        supabase.table("admins")
        .select("*")
        .eq("uid", uid)
        .eq("role", AdminRole.EVENT_MANAGER.value)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event manager not found",
        )

    em = Admin.from_row(row)
    my_events: list[str] = [str(e) for e in (em.events or [])]

    if my_events:
        others_resp = await (
            supabase.table("admins")
            .select("events")
            .eq("role", AdminRole.EVENT_MANAGER.value)
            .neq("uid", uid)
            .execute()
        )
        other_rows = rows(others_resp)

        covered_by_others: set[str] = set()
        for other in other_rows:
            for eid in (other.get("events") or []):
                covered_by_others.add(str(eid))

        sole_managed = [eid for eid in my_events if eid not in covered_by_others]

        if sole_managed:
            ev_resp = await (
                supabase.table("events")
                .select("id, name")
                .execute()
            )
            all_events_map = {str(e["id"]): e["name"] for e in rows(ev_resp)}
            event_names = [all_events_map.get(eid, eid) for eid in sole_managed]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{em.name} is the sole event manager for: "
                    + ", ".join(f"'{n}'" for n in event_names)
                    + ". Assign a replacement manager before removing them."
                ),
            )

    saved = {
        "uid": em.uid,
        "username": em.username,
        "name": em.name,
        "phone": em.phone,
        "mail": em.mail,
        "events": em.events or [],
        "message": f"Event manager '{em.username}' removed successfully",
    }

    await (
        supabase.table("admins")
        .delete()
        .eq("uid", uid)
        .execute()
    )
    return saved


# ── Event Detail / Update ────────────────────────────────────────────────────


async def get_event_detail(
    supabase: AsyncClient,
    admin: Admin,
    event_id: str,
) -> dict:
    """
    Return full detail for a single event including participant list.
    admin → any event; eventManager → assigned events only.
    """
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

    participants: list[dict] = []
    registered = attended = submitted_count = restricted_count = 0
    submitted_teams_seen: set[str] = set()
    registered_teams: set[str] = set()

    for user in all_users:
        entry = (user.events or {}).get(event_id)
        if entry is None:
            continue
        registered += 1
        team_id = entry.get("teamId")
        if team_id:
            registered_teams.add(str(team_id))
        is_submitted = _has_any_submission(entry)
        is_attending = bool(entry.get("isAttending", False))
        is_restricted = bool(entry.get("restricted", False))
        if is_submitted:
            if team_id:
                if str(team_id) not in submitted_teams_seen:
                    submitted_teams_seen.add(str(team_id))
                    submitted_count += 1
            else:
                submitted_count += 1
        if is_attending:
            attended += 1
        if is_restricted:
            restricted_count += 1

        participants.append({
            "id": str(user.id),
            "name": user.name,
            "teamId": entry.get("teamId"),
            "status": "restricted" if is_restricted else "active",
            "submitted": is_submitted,
            "isAttending": is_attending,
        })

    return {
        "id": event_id,
        "name": event.name,
        "title": event.title or "",
        "description": event.description,
        "category": event.category or "Other",
        "date": event.start_date.date().isoformat() if event.start_date else None,
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "registration_deadline": event.registration_deadline.isoformat() if event.registration_deadline else None,
        "venue": event.venue or [],
        "maxParticipants": event.max_participants,
        "registered": registered,
        "teams": len(registered_teams),
        "attended": attended,
        "submitted": submitted_count,
        "submittedTeams": submitted_count,
        "restricted": restricted_count,
        "communityLink": event.community_link,
        "rules": event.rules or "",
        "judges": event.judges or [],
        "rounds": event.rounds or {},
        "questions": event.questions or {},
        "participants": participants,
    }


async def update_event_details(
    supabase: AsyncClient,
    admin: Admin,
    event_id: str,
    patch_data: dict,
) -> dict:
    """
    Update core event fields.
    admin       → any event
    eventManager → must be assigned to this event
    """
    all_events = await _all_events_lean(supabase)
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

    # Build DB patch — only include explicitly provided (non-None) fields
    db_patch: dict = {}
    if patch_data.get("name") is not None:
        db_patch["name"] = patch_data["name"]
    if patch_data.get("title") is not None:
        db_patch["title"] = patch_data["title"]
    if patch_data.get("description") is not None:
        db_patch["description"] = patch_data["description"]
    if patch_data.get("venue") is not None:
        db_patch["venue"] = patch_data["venue"]
    if patch_data.get("date") is not None:
        db_patch["start_date"] = patch_data["date"]   # stored as start_date in DB
    if patch_data.get("end_date") is not None:
        db_patch["end_date"] = patch_data["end_date"]
    if patch_data.get("registration_deadline") is not None:
        db_patch["registration_deadline"] = patch_data["registration_deadline"]
    if patch_data.get("category") is not None:
        db_patch["category"] = patch_data["category"]
    if patch_data.get("maxParticipants") is not None:
        db_patch["max_participants"] = patch_data["maxParticipants"]
    if patch_data.get("communityLink") is not None:
        db_patch["community_link"] = patch_data["communityLink"]
    if patch_data.get("rules") is not None:
        db_patch["rules"] = patch_data["rules"]
    if patch_data.get("judges") is not None:
        db_patch["judges"] = patch_data["judges"]
    if patch_data.get("rounds") is not None:
        db_patch["rounds"] = patch_data["rounds"]
    if patch_data.get("questions") is not None:
        db_patch["questions"] = patch_data["questions"]

    if not db_patch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    event_uuid = _parse_event_uuid(event_id)
    update_resp = await (
        supabase.table("events")
        .update(db_patch)
        .eq("id", str(event_uuid))
        .execute()
    )
    _ = first_row(update_resp)

    # Bust the cache so subsequent reads see the updated data
    _invalidate_lean_cache()

    # Re-fetch for a consistent return shape
    return await get_event_detail(supabase, admin, event_id)
