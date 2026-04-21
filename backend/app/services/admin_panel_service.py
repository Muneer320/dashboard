"""
admin_panel_service.py
======================
Business logic for all /admin-panel/* endpoints.

Scoping rules
─────────────
  admin        → sees / can modify everything
  eventManager → scoped to event IDs listed in admin.events JSONB
  Scanner      → no data-read access (403) except lookup_participant
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import Admin, AdminRole
from app.models.event import Event
from app.models.user import User


# ── Helpers ───────────────────────────────────────────────────────────────────

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
        detail="Access denied — insufficient role",
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


def _build_participant_dict(
    user: "User",
    event_id: str,
    event_name: str,
    entry: dict,
) -> dict:
    """Build the ParticipantItem dict from a user + one event entry.

    submission shape (new): { repoLink, deployLink, submittedAt } | None
    Old shape (pre-migration): False | True — handled gracefully.
    """
    food = user.food or {}
    sub = entry.get("submission")  # None, False, or dict
    is_submitted = bool(sub)       # False/None → False, non-empty dict → True
    repo_link = sub.get("repoLink") if isinstance(sub, dict) else None
    deploy_link = sub.get("deployLink") if isinstance(sub, dict) else None
    return {
        "id": str(user.id),
        "name": user.name,
        "username": user.username,
        "eventId": event_id,
        "eventName": event_name,
        "teamId": entry.get("teamId"),
        "status": "restricted" if entry.get("restricted") else "active",
        "isAttending": bool(entry.get("isAttending", False)),
        "foodClaimed": any(food.values()),
        "entryScanned": bool(user.is_attending),
        "submitted": is_submitted,
        "submissionURL": deploy_link,    # deploy link maps to "URL" field for admin UI
        "submissionFile": repo_link,     # repo link maps to "File" field for admin UI
    }


# ── Service functions ─────────────────────────────────────────────────────────

async def get_overview_stats(session: AsyncSession, admin: Admin) -> dict:
    """Aggregate stats cards for the Overview tab."""
    # Load all events
    ev_result = await session.execute(select(Event))
    all_events = list(ev_result.scalars().all())
    all_event_ids = [str(e.id) for e in all_events]

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))

    # Load all users
    u_result = await session.execute(select(User))
    all_users = list(u_result.scalars().all())

    registered_ids: set[str] = set()
    attending = 0
    restricted = 0
    submitted = 0
    entry_scanned = 0
    food_claimed = 0

    for user in all_users:
        user_events: dict = user.events or {}
        user_in_scope = False

        for eid, entry in user_events.items():
            if eid not in scoped_ids:
                continue
            user_in_scope = True
            if entry.get("isAttending"):
                attending += 1
            if entry.get("restricted"):
                restricted += 1
            if entry.get("submission"):
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
        "attending": attending,
        "restricted": restricted,
        "foodClaimed": food_claimed,
        "entryScanned": entry_scanned,
        "submitted": submitted,
        "eventCount": len(scoped_ids),
    }


async def get_events_with_stats(session: AsyncSession, admin: Admin) -> list[dict]:
    """Per-event stat rows for the Overview events breakdown table."""
    ev_result = await session.execute(select(Event))
    all_events = list(ev_result.scalars().all())
    all_event_ids = [str(e.id) for e in all_events]

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))
    scoped_events = [e for e in all_events if str(e.id) in scoped_ids]

    u_result = await session.execute(select(User))
    all_users = list(u_result.scalars().all())

    result: list[dict] = []
    for event in scoped_events:
        eid = str(event.id)
        registered = attended = submitted_count = restricted_count = 0

        for user in all_users:
            entry = (user.events or {}).get(eid)
            if entry is None:
                continue
            registered += 1
            if entry.get("isAttending"):
                attended += 1
            if entry.get("submission"):
                submitted_count += 1
            if entry.get("restricted"):
                restricted_count += 1

        result.append({
            "id": eid,
            "name": event.name,
            "category": "",          # no category column in schema
            "date": event.start_date.date().isoformat() if event.start_date else None,
            "venue": event.venue or [],
            "maxParticipants": event.max_participants,
            "registered": registered,
            "attended": attended,
            "submitted": submitted_count,
            "restricted": restricted_count,
        })

    return result


async def get_participants_list(
    session: AsyncSession,
    admin: Admin,
    event_id: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
) -> list[dict]:
    """Participants table with optional filters."""
    ev_result = await session.execute(select(Event))
    all_events = list(ev_result.scalars().all())
    all_event_ids = [str(e.id) for e in all_events]
    event_name_map = {str(e.id): e.name for e in all_events}

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))

    # Narrow to a specific event if requested
    if event_id is not None:
        if event_id not in scoped_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this event",
            )
        scoped_ids = {event_id}

    u_result = await session.execute(select(User))
    all_users = list(u_result.scalars().all())

    result: list[dict] = []
    for user in all_users:
        # Name / username search
        if search:
            s = search.lower()
            if s not in user.name.lower() and s not in user.username.lower():
                continue

        user_events: dict = user.events or {}

        for eid, entry in user_events.items():
            if eid not in scoped_ids:
                continue

            is_restricted = bool(entry.get("restricted", False))

            # Status filter
            if status_filter == "restricted" and not is_restricted:
                continue
            if status_filter == "active" and is_restricted:
                continue

            result.append(
                _build_participant_dict(user, eid, event_name_map.get(eid, ""), entry)
            )

    return result


async def restrict_participant(
    session: AsyncSession,
    admin: Admin,
    user_id: str,
    event_id: str,
    restricted: bool,
) -> dict:
    """
    Set or clear user.events[event_id]["restricted"].
    Also syncs event.participants[user_id]["status"] for consistency.
    eventManager must own the event.
    """
    # eventManager scope check
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
    u_result = await session.execute(select(User).where(User.id == user_uuid))
    user = u_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_events: dict = user.events or {}
    if event_id not in user_events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not registered for this event",
        )

    # Update user.events JSONB
    user_events[event_id]["restricted"] = restricted
    user.events = user_events
    session.add(user)

    # Sync event.participants status for consistency
    event_uuid = _parse_event_uuid(event_id)
    ev_result = await session.execute(select(Event).where(Event.id == event_uuid))
    event = ev_result.scalar_one_or_none()
    if event:
        participants: dict = event.participants or {}
        if user_id in participants:
            participants[user_id]["status"] = "eliminated" if restricted else "active"
            event.participants = participants
            session.add(event)

    await session.commit()
    return {"user_id": user_id, "event_id": event_id, "restricted": restricted}


async def lookup_participant(
    session: AsyncSession,
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
    ev_result = await session.execute(select(Event))
    all_events = list(ev_result.scalars().all())
    all_event_ids = [str(e.id) for e in all_events]
    event_name_map = {str(e.id): e.name for e in all_events}

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids, allow_scanner=True))

    if event_id is not None:
        scoped_ids = {event_id} if event_id in scoped_ids else set()

    # ── Exact UUID lookup ──
    if user_id is not None:
        user_uuid = _parse_user_uuid(user_id)
        u_result = await session.execute(select(User).where(User.id == user_uuid))
        user = u_result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found."
            )
        users = [user]

    # ── Name / username search ──
    elif q:
        u_result = await session.execute(
            select(User).where(
                or_(User.name.ilike(f"%{q}%"), User.username.ilike(f"%{q}%"))
            )
        )
        users = list(u_result.scalars().all())
        if not users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found."
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide user_id or q query parameter",
        )

    result: list[dict] = []
    for user in users:
        for eid, entry in (user.events or {}).items():
            if eid not in scoped_ids:
                continue
            result.append(
                _build_participant_dict(user, eid, event_name_map.get(eid, ""), entry)
            )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found."
        )

    return result


async def get_my_events(session: AsyncSession, admin: Admin) -> list[dict]:
    """Events with full participant list for My Events tab."""
    ev_result = await session.execute(select(Event))
    all_events = list(ev_result.scalars().all())
    all_event_ids = [str(e.id) for e in all_events]

    scoped_ids = set(_get_scoped_event_ids(admin, all_event_ids))
    scoped_events = [e for e in all_events if str(e.id) in scoped_ids]

    u_result = await session.execute(select(User))
    all_users = list(u_result.scalars().all())

    result: list[dict] = []
    for event in scoped_events:
        eid = str(event.id)
        participants: list[dict] = []
        registered = attended = submitted_count = 0

        for user in all_users:
            entry = (user.events or {}).get(eid)
            if entry is None:
                continue

            registered += 1
            sub = entry.get("submission")  # None, False, or dict
            is_submitted = bool(sub)
            is_attending = bool(entry.get("isAttending", False))
            if is_submitted:
                submitted_count += 1
            if is_attending:
                attended += 1

            participants.append({
                "id": str(user.id),
                "name": user.name,
                "teamId": entry.get("teamId"),
                "status": "restricted" if entry.get("restricted") else "active",
                "submitted": is_submitted,
                "isAttending": is_attending,
                "submissionURL": sub.get("deployLink") if isinstance(sub, dict) else None,
                "submissionFile": sub.get("repoLink") if isinstance(sub, dict) else None,
            })

        result.append({
            "id": eid,
            "name": event.name,
            "venue": event.venue or [],
            "date": event.start_date.isoformat() if event.start_date else None,
            "maxParticipants": event.max_participants,
            "registered": registered,
            "submitted": submitted_count,
            "attended": attended,
            "participants": participants,
        })

    return result


async def get_event_managers(session: AsyncSession) -> list[dict]:
    """All eventManager rows — admin-only Contact Info tab."""
    result = await session.execute(
        select(Admin).where(Admin.role == AdminRole.EVENT_MANAGER)
    )
    managers = list(result.scalars().all())
    return [
        {
            "uid": m.uid,
            "username": m.username,
            "name": m.name,
            "phone": m.phone,
            "mail": m.mail,
            "events": m.events or [],
        }
        for m in managers
    ]


async def create_event_manager(
    session: AsyncSession,
    username: str,
    name: str,
    password: str,
    mail: str,
    phone: str | None,
    events: list[str],
) -> dict:
    """
    Create a new Admin row with role=eventManager.
    Raises 409 if username or mail is already taken.
    """
    from app.core.security import get_password_hash

    # Uniqueness checks
    existing_username = await session.execute(
        select(Admin).where(Admin.username == username)
    )
    if existing_username.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{username}' is already taken",
        )

    existing_mail = await session.execute(
        select(Admin).where(Admin.mail == mail)
    )
    if existing_mail.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{mail}' is already registered",
        )

    em = Admin(
        role=AdminRole.EVENT_MANAGER,
        username=username,
        name=name,
        password_hash=get_password_hash(password),
        mail=mail,
        phone=phone,
        events=events,
    )
    session.add(em)
    await session.commit()
    await session.refresh(em)

    return {
        "uid": em.uid,
        "username": em.username,
        "name": em.name,
        "phone": em.phone,
        "mail": em.mail,
        "events": em.events or [],
        "message": "Event manager created successfully",
    }


async def update_event_manager(
    session: AsyncSession,
    uid: int,
    name: str | None,
    mail: str | None,
    phone: str | None,
    events: list[str] | None,
) -> dict:
    """
    Update an eventManager's profile fields.
    Only fields provided (non-None) are changed.
    Passing events=[...] fully replaces the assigned events list.
    """
    result = await session.execute(
        select(Admin).where(Admin.uid == uid, Admin.role == AdminRole.EVENT_MANAGER)
    )
    em = result.scalar_one_or_none()
    if em is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event manager not found",
        )

    if name is not None:
        em.name = name
    if mail is not None:
        # Check mail uniqueness against other admins
        conflict = await session.execute(
            select(Admin).where(Admin.mail == mail, Admin.uid != uid)
        )
        if conflict.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{mail}' is already registered",
            )
        em.mail = mail
    if phone is not None:
        em.phone = phone
    if events is not None:
        em.events = events   # full replacement

    session.add(em)
    await session.commit()
    await session.refresh(em)

    return {
        "uid": em.uid,
        "username": em.username,
        "name": em.name,
        "phone": em.phone,
        "mail": em.mail,
        "events": em.events or [],
        "message": "Event manager updated successfully",
    }


async def delete_event_manager(session: AsyncSession, uid: int) -> dict:
    """
    Delete an eventManager account.

    Restriction: if this EM is the SOLE manager of any event (i.e. no other EM
    has that event in their events list), the deletion is blocked until the admin
    assigns a replacement.
    """
    result = await session.execute(
        select(Admin).where(Admin.uid == uid, Admin.role == AdminRole.EVENT_MANAGER)
    )
    em = result.scalar_one_or_none()
    if em is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event manager not found",
        )

    my_events: list[str] = [str(e) for e in (em.events or [])]

    if my_events:
        # Load all OTHER event managers
        others_result = await session.execute(
            select(Admin).where(
                Admin.role == AdminRole.EVENT_MANAGER,
                Admin.uid != uid,
            )
        )
        other_ems = list(others_result.scalars().all())

        # Build a set of event IDs covered by at least one other EM
        covered_by_others: set[str] = set()
        for other in other_ems:
            for eid in (other.events or []):
                covered_by_others.add(str(eid))

        # Find events where this EM is the sole manager
        sole_managed = [eid for eid in my_events if eid not in covered_by_others]

        if sole_managed:
            # Look up event names for a helpful error message
            ev_result = await session.execute(select(Event))
            all_events = {str(e.id): e.name for e in ev_result.scalars().all()}
            event_names = [
                all_events.get(eid, eid) for eid in sole_managed
            ]
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

    await session.delete(em)
    await session.commit()
    return saved
