"""
Bulk-enroll service.

Takes a CSV or XLSX roster (exported from Unstop / registration forms) plus a
target event_id and:
  - Creates a ``users`` row for every email we haven't seen before (with a
    fresh 12-char alphanumeric password, hashed into ``password_hash``), and
    enrols them in the event.
  - If a user already exists in ``users`` but is NOT yet registered for the
    target event, append the missing event entry to their ``events`` map using
    a targeted column update. This preserves multi-event registrations without
    rewriting unrelated profile fields.
  - If the user is already registered for the target event, treat the row as a
    duplicate and skip it.
  - For teams referenced in the file: NEW teams are inserted with the new
    users as members; EXISTING teams have new user IDs *appended* to the
    member_ids array — the upsert is non-destructive, never removing any
    existing member. Stale memberships (e.g. someone who left a team) need
    to be cleaned up separately.
  - Returns the admin a summary + the list of newly-created credentials so
    they can send login details to the participants.

The route handler lives in ``app.api.routes.admin_panel``.
"""

from __future__ import annotations

import asyncio
import csv
import io
import re
import secrets
import string
import uuid
from typing import Any

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.security import get_password_hash
from app.db.supabase_client import first_row, rows
from app.models.user import User


# ── Column aliases ─────────────────────────────────────────────────────────────
#
# Admins export from a dozen different tools — normalise header names to our
# canonical keys. Match is case-insensitive after stripping spaces, dashes,
# and underscores. First alias is the canonical name.

_ALIAS_MAP: dict[str, list[str]] = {
    "email": ["email", "emailid", "emailaddress", "mail", "mailid", "candidatesemail"],
    "name":  ["name", "fullname", "participantname", "studentname", "candidatesname"],
    "phone": ["phone", "mobile", "contact", "phonenumber", "mobilenumber", "contactnumber", "candidatesmobile"],
    "college": ["college", "institute", "institution", "university", "school", "candidatesorganisation"],
    "year":  ["year", "studyyear", "currentyear", "academicyear", "yearofgraduation"],
    "branch": [
        "branch", "course", "specialization", "specialisation", "stream",
        "department", "dept", "major", "coursespecialization",
    ],
    "gender": ["gender", "sex", "candidatesgender"],
    "city":   ["city", "location", "hometown", "candidateslocation"],
    "emergency_contact": ["emergencycontact", "emergency", "ec", "guardiancontact", "parentcontact"],
    "team_id": ["teamid", "groupid"],
    "team_name": ["teamname", "team", "groupname", "group"],
}


def _norm_header(s: str) -> str:
    return re.sub(r"[\s_\-.\']+", "", (s or "").strip().lower())


def _resolve_headers(headers: list[str]) -> dict[str, str]:
    """
    Given the raw header row, return a mapping of canonical_key → original_header
    for every field we were able to recognise. Unknown headers are dropped.
    """
    lookup: dict[str, str] = {}
    for raw in headers:
        norm = _norm_header(raw)
        for canonical, aliases in _ALIAS_MAP.items():
            if canonical in lookup:
                continue  # first match wins
            if norm in aliases:
                lookup[canonical] = raw
                break
    return lookup


# ── Password generator ────────────────────────────────────────────────────────

_PASSWORD_ALPHABET = string.ascii_letters + string.digits


def _generate_password(length: int = 12) -> str:
    """12 chars, letters + digits, cryptographically random."""
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))


# ── Email helper ──────────────────────────────────────────────────────────────
#
# Accept the canonical "archived-a4bfb89905@example.invalid" shape. We keep the regex loose —
# it's on the admin to upload clean data; we just guard against obvious typos.

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _clean_email(raw: Any) -> str | None:
    s = str(raw or "").strip().lower()
    if not s or not _EMAIL_RE.match(s):
        return None
    return s


# ── File parsing ──────────────────────────────────────────────────────────────

def parse_upload(filename: str, content: bytes) -> list[dict[str, Any]]:
    """
    Decode a CSV or XLSX upload into a list of row dicts keyed by canonical
    field names (email, name, phone, college, …). Rows that don't match any
    column are still included but will be flagged downstream.

    Raises 400 if the format is unsupported or the file can't be read.
    """
    lower = (filename or "").lower()

    if lower.endswith(".csv"):
        return _parse_csv(content)
    if lower.endswith(".xlsx") or lower.endswith(".xlsm"):
        return _parse_xlsx(content)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format — please upload a .csv or .xlsx file.",
    )


def _parse_csv(content: bytes) -> list[dict[str, Any]]:
    # BOM-safe decode — Excel exports often start with \ufeff.
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not decode CSV — try saving it as UTF-8.",
            ) from exc

    # sniff the delimiter (comma / semicolon / tab) — fall back to comma.
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(io.StringIO(text), dialect)
    try:
        header_row = next(reader)
    except StopIteration:
        return []

    header_map = _resolve_headers(header_row)
    if "email" not in header_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV is missing an 'email' column.",
        )

    # index of each canonical column in the raw row
    col_index = {k: header_row.index(v) for k, v in header_map.items()}

    result: list[dict[str, Any]] = []
    for raw in reader:
        if not any((cell or "").strip() for cell in raw):
            continue  # skip blank rows
        row: dict[str, Any] = {}
        for canonical, idx in col_index.items():
            if idx < len(raw):
                row[canonical] = raw[idx]
        result.append(row)
    return result


def _parse_xlsx(content: bytes) -> list[dict[str, Any]]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "XLSX support requires openpyxl. Install it on the server "
                "(pip install openpyxl) or upload as CSV."
            ),
        ) from exc

    try:
        wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read XLSX: {exc}",
        ) from exc

    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = [("" if c is None else str(c)) for c in next(rows_iter)]
    except StopIteration:
        return []

    header_map = _resolve_headers(header_row)
    if "email" not in header_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Spreadsheet is missing an 'email' column.",
        )
    col_index = {k: header_row.index(v) for k, v in header_map.items()}

    result: list[dict[str, Any]] = []
    for raw in rows_iter:
        if raw is None or not any(c not in (None, "") for c in raw):
            continue
        row: dict[str, Any] = {}
        for canonical, idx in col_index.items():
            if idx < len(raw):
                v = raw[idx]
                row[canonical] = "" if v is None else v
        result.append(row)
    return result


# ── Enrollment ────────────────────────────────────────────────────────────────

def _default_event_entry(team_uuid: str | None = None) -> dict:
    """Fresh enrollment record for a brand-new registration."""
    return {
        "isAttending": False,
        "phase": 0,
        "status": "registered",
        "restricted": False,
        "teamId": team_uuid,  # event-scoped; a user can be in different teams per event
        "score": None,
        "rank": None,
        "submission": None,
    }


def _details_from_row(row: dict[str, Any], email: str) -> dict:
    """Build the users.details JSONB from a parsed roster row."""
    def _s(key: str) -> str:
        return str(row.get(key, "") or "").strip()

    return {
        "email": email,
        "phone": _s("phone"),
        "college": _s("college"),
        "year": _s("year"),
        "branch": _s("branch"),
        "gender": _s("gender"),
        "city": _s("city"),
        "emergency_contact": _s("emergency_contact"),
    }


async def _fetch_event(supabase: AsyncClient, event_id: str) -> dict:
    try:
        uuid.UUID(event_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event_id",
        ) from exc

    resp = await (
        supabase.table("events")
        .select("id, name")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return {"id": str(row["id"]), "name": row["name"]}


async def bulk_enroll(
    supabase: AsyncClient,
    event_id: str,
    parsed_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Main driver.

    Returns a dict with:
      - event: { id, name }
      - summary: { total_rows, created, added_to_existing, duplicates, errors }
      - new_credentials: [{ email, password, name, event }]
      - added_to_existing: [{ email, user_id, name }]
      - duplicates_detail: [{ row, email }]
      - errors_detail: [{ row, email, reason }]
    """
    event = await _fetch_event(supabase, event_id)
    event_uuid = event["id"]
    event_name = event["name"]

    prepared: list[dict[str, Any]] = []
    errors_detail: list[dict[str, Any]] = []
    seen_in_file: set[str] = set()

    # team_uuid → team payload; only populated for users with a real team_id.
    teams_to_upsert: dict[str, dict] = {}
    # team_uuid → list of user emails in that team (resolved to IDs later)
    team_email_members: dict[str, list[str]] = {}

    for idx, row in enumerate(parsed_rows, start=2):  # row 1 is the header
        email = _clean_email(row.get("email"))
        if not email:
            continue
        if email in seen_in_file:
            # Duplicate within the same file — skip silently.
            continue
        seen_in_file.add(email)

        unstop_team_id = str(row.get("team_id") or "").strip()
        if unstop_team_id:
            # Deterministic UUID so the same Unstop team always maps to the
            # same DB row, even across multiple uploads.
            team_uuid: str | None = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{event_uuid}:{unstop_team_id}"))
            team_name = str(row.get("team_name") or f"Team {unstop_team_id}").strip()
            teams_to_upsert[team_uuid] = {
                "id": team_uuid,
                "name": team_name,
                "event_id": event_uuid,
                "leader_id": None,  # set nullable; no single leader during bulk enroll
            }
            team_email_members.setdefault(team_uuid, []).append(email)
        else:
            # Solo participant — no team assignment.
            team_uuid = None

        prepared.append({
            "row_idx": idx,
            "email": email,
            "name": str(row.get("name") or "").strip() or email.split("@")[0],
            "raw": row,
            "team_uuid": team_uuid,
        })

    # ── Fetch all existing users in one (chunked) query ───────────────────────
    emails = [p["email"] for p in prepared]
    existing_map: dict[str, dict] = {}
    if emails:
        CHUNK = 500
        for i in range(0, len(emails), CHUNK):
            chunk = emails[i : i + CHUNK]
            resp = await (
                supabase.table("users")
                .select("*")
                .in_("username", chunk)
                .execute()
            )
            for r in rows(resp):
                existing_map[str(r["username"]).lower()] = r

    # ── Classify each prepared row ────────────────────────────────────────────
    created: list[dict[str, Any]] = []
    added_to_existing: list[dict[str, Any]] = []
    duplicates_detail: list[dict[str, Any]] = []

    # New users: need password hashing (CPU-bound → thread pool).
    new_user_tasks: list[Any] = []

    # Existing users that need their events map updated.
    existing_user_updates: list[dict[str, Any]] = []  # {id, events, email, name}

    async def _prepare_new_user(
        _email: str,
        _name: str,
        _raw: dict,
        _team_uuid: str | None,
    ) -> tuple[dict, dict]:
        plain_password = _generate_password(12)
        # Offload the heavy bcrypt hashing to avoid blocking the event loop.
        hashed_pw = await asyncio.to_thread(get_password_hash, plain_password)

        _entry = _default_event_entry(team_uuid=_team_uuid)

        _payload = {
            "id": str(uuid.uuid4()),
            "username": _email,
            "password_hash": hashed_pw,
            "name": _name,
            "unstop_id": None,
            "is_attending": False,
            "details": _details_from_row(_raw, _email),
            "events": {event_uuid: _entry},
            "food": {},
            "is_profile_complete": False,
            "cents": 0,
        }

        _cred = {
            "email": _email,
            "password": plain_password,
            "name": _name,
            "event": event_name,
            "event_id": event_uuid,
        }
        return _payload, _cred

    for p in prepared:
        email = p["email"]
        row_idx = p["row_idx"]
        name = p["name"]
        raw = p["raw"]
        team_uuid = p["team_uuid"]

        existing_row = existing_map.get(email)

        if existing_row is not None:
            user = User.from_row(existing_row)
            events_map = dict(user.events or {})

            if event_uuid in events_map:
                # Already registered for this event — keep the current row
                # untouched so same-event re-uploads remain safe and idempotent.
                duplicates_detail.append({"row": row_idx, "email": email})
                continue

            # Existing user, new event — this is the legitimate multi-event case
            # that the admin uploader must support. Update only the events JSON;
            # other profile fields stay as-is.
            events_map[event_uuid] = _default_event_entry(team_uuid=team_uuid)
            existing_user_updates.append({
                "id": str(user.id),
                "email": email,
                "name": user.name,
                "events": events_map,
            })
            added_to_existing.append({
                "email": email,
                "user_id": str(user.id),
                "name": user.name,
            })
            continue

        # Brand-new user — queue for concurrent password hashing.
        new_user_tasks.append(_prepare_new_user(email, name, raw, team_uuid))

    # ── Hash passwords concurrently, then batch-insert new users ─────────────
    new_user_payloads: list[dict] = []
    if new_user_tasks:
        # return_exceptions=True so one bcrypt failure doesn't abort the rest
        gather_results = await asyncio.gather(*new_user_tasks, return_exceptions=True)
        for item in gather_results:
            if isinstance(item, BaseException):
                errors_detail.append({
                    "row": -1,
                    "email": "password-hash",
                    "reason": f"Password hashing failed: {item}",
                })
                continue
            payload, cred = item
            new_user_payloads.append(payload)
            created.append(cred)

    if new_user_payloads:
        for i in range(0, len(new_user_payloads), 500):
            batch = new_user_payloads[i : i + 500]
            try:
                # Note: supabase-py v1 does not support .select() after
                # .insert() — omit it and trust that no raised exception
                # means the insert succeeded. The credentials are already
                # in `created` from the gather step above, so we don't
                # need the returned rows for the CSV.
                await supabase.table("users").insert(batch).execute()
            except Exception as exc:
                errors_detail.append({
                    "row": -1,
                    "email": "new-users-insert",
                    "reason": f"New-user batch insert failed: {exc}",
                })

    # ── Update existing users' events map ───────────────────────────────────
    #
    # Only the ``events`` JSON column is updated. This restores the intended
    # "same user can join multiple events" behavior without resurrecting the old
    # full-row upsert that could clobber unrelated state.
    if existing_user_updates:
        sem = asyncio.Semaphore(20)

        async def _update_existing_user(upd: dict[str, Any]) -> None:
            async with sem:
                try:
                    await (
                        supabase.table("users")
                        .update({"events": upd["events"]})
                        .eq("id", upd["id"])
                        .execute()
                    )
                except Exception as exc:
                    errors_detail.append({
                        "row": -1,
                        "email": upd["email"],
                        "reason": f"Failed to update existing user event map: {exc}",
                    })

        await asyncio.gather(*[_update_existing_user(upd) for upd in existing_user_updates])

    # ── Teams: non-destructive create/append ─────────────────────────────────
    #
    # Important: we MUST NOT use bulk upsert with on_conflict="id" the way
    # this used to. That replaces the entire row, so when an existing team's
    # roster shrinks in the new CSV (because someone left on Unstop), the
    # upsert silently destroys the team's previous member_ids — that's the
    # exact bug we're fixing.
    #
    # Instead:
    #   1. Read the current member_ids of any team UUIDs that already exist.
    #   2. For existing teams: APPEND new user IDs to their current member_ids
    #      (dedup-preserving), and only write if there's something to add.
    #   3. For brand-new teams: insert with the new users as members.
    #
    # We never remove anyone from a team here. Stale team membership (from
    # users who left on Unstop) needs a separate cleanup pass — out of scope
    # for the bulk upload because we have no ground truth for "who left."
    if teams_to_upsert:
        # email→user_id map from both newly-created users and existing users
        # who were legitimately added to this event during this upload.
        email_to_id: dict[str, str] = {}
        for p in new_user_payloads:
            email_to_id[p["username"]] = p["id"]
        for upd in existing_user_updates:
            email_to_id[upd["email"]] = upd["id"]

        team_uuids = list(teams_to_upsert.keys())

        # Fetch current state of any teams already in DB.
        existing_teams: dict[str, dict] = {}
        if team_uuids:
            for i in range(0, len(team_uuids), 200):
                chunk = team_uuids[i : i + 200]
                try:
                    resp = await (
                        supabase.table("teams")
                        .select("id, member_ids")
                        .in_("id", chunk)
                        .execute()
                    )
                    for r in rows(resp):
                        existing_teams[str(r["id"])] = r
                except Exception as exc:
                    errors_detail.append({
                        "row": -1,
                        "email": "teams-prefetch",
                        "reason": f"Could not prefetch existing teams: {exc}",
                    })

        new_team_inserts: list[dict] = []
        existing_team_appends: list[tuple[str, list[str]]] = []  # (team_id, merged_member_ids)

        for t_uuid, t_payload in teams_to_upsert.items():
            member_emails = team_email_members.get(t_uuid, [])
            new_member_ids = [email_to_id[e] for e in member_emails if e in email_to_id]

            existing = existing_teams.get(t_uuid)
            if existing is None:
                # Brand-new team — only meaningful if it has at least one new
                # user. (A team with no new members and no existing row would
                # be an empty stub, which we skip.)
                if not new_member_ids:
                    continue
                new_team_inserts.append({**t_payload, "member_ids": new_member_ids})
            else:
                # Team exists. Merge new IDs into current member_ids without
                # removing anyone. dict.fromkeys preserves order while deduping.
                current_members = list(existing.get("member_ids") or [])
                merged = list(dict.fromkeys(current_members + new_member_ids))
                if merged == current_members:
                    continue   # nothing to add — leave the team untouched
                existing_team_appends.append((t_uuid, merged))

        # Insert brand-new teams — safe to bulk-insert; no conflict possible.
        for i in range(0, len(new_team_inserts), 200):
            try:
                await supabase.table("teams").insert(
                    new_team_inserts[i : i + 200]
                ).execute()
            except Exception as exc:
                errors_detail.append({
                    "row": -1,
                    "email": "teams-insert",
                    "reason": f"New team batch insert failed: {exc}",
                })

        # Append-only updates for existing teams. We can't bulk-set different
        # member_ids per row in one Supabase REST call, so fan out under a
        # semaphore to keep the connection pool sane.
        if existing_team_appends:
            sem = asyncio.Semaphore(20)

            async def _append_one(team_id: str, merged_members: list[str]) -> None:
                async with sem:
                    try:
                        await (
                            supabase.table("teams")
                            .update({"member_ids": merged_members})
                            .eq("id", team_id)
                            .execute()
                        )
                    except Exception as exc:
                        errors_detail.append({
                            "row": -1,
                            "email": f"team:{team_id}",
                            "reason": f"Failed to append to team: {exc}",
                        })

            await asyncio.gather(*[
                _append_one(tid, members) for tid, members in existing_team_appends
            ])

    return {
        "event": event,
        "summary": {
            "total_rows": len(parsed_rows),
            "created": len(created),
            "added_to_existing": len(added_to_existing),
            "duplicates": len(duplicates_detail),
            "errors": len(errors_detail),
        },
        "new_credentials": created,
        "added_to_existing": added_to_existing,
        "duplicates_detail": duplicates_detail,
        "errors_detail": errors_detail,
    }


# ── Uncovered-user helpers ────────────────────────────────────────────────────
#
# Given a CSV of users who have already received their credentials (columns:
# name, email, password), surface the users present in the DB but missing
# from that file. The follow-up "regenerate passwords + send emails" pass
# uses regenerate_passwords_for_ids() below, batched from the frontend so
# we don't trip the proxy timeout the way the original bulk-upload path did.


async def find_uncovered_users(
    supabase: AsyncClient,
    covered_emails: list[str],
) -> list[dict[str, Any]]:
    """
    Return DB users whose ``username`` (email) is NOT in ``covered_emails``.

    Comparison is case-insensitive and trim-tolerant. We page through the
    users table to dodge Supabase's 1000-row default limit so the diff is
    correct even on large festivals.
    """
    norm_covered = {e.strip().lower() for e in covered_emails if e and "@" in e}

    PAGE = 1000
    all_rows: list[dict] = []
    start = 0
    while True:
        resp = await (
            supabase.table("users")
            .select("id, name, username")
            .range(start, start + PAGE - 1)
            .execute()
        )
        page_rows = rows(resp)
        if not page_rows:
            break
        all_rows.extend(page_rows)
        if len(page_rows) < PAGE:
            break
        start += PAGE

    uncovered: list[dict[str, Any]] = []
    for u in all_rows:
        un = (u.get("username") or "").strip().lower()
        if un and un not in norm_covered:
            uncovered.append({
                "id":    str(u["id"]),
                "name":  u.get("name") or "",
                "email": u["username"],
            })
    # Stable, alphabetical-by-email order so re-running gives the same display
    uncovered.sort(key=lambda r: r["email"])
    return uncovered


async def regenerate_passwords_for_ids(
    supabase: AsyncClient,
    user_ids: list[str],
) -> list[dict[str, Any]]:
    """
    For each user id: generate a new 12-char password, bcrypt it, update the
    user row, and return the plaintext credential so the caller (frontend)
    can email it out.

    ⚠️ DESTRUCTIVE — overwrites password_hash. Any existing session whose
    token survives is unaffected (JWTs aren't stored), but the next login
    will require the new password.
    """
    if not user_ids:
        return []

    # Validate ids upfront — one bad uuid shouldn't poison the batch.
    valid_ids: list[str] = []
    for uid in user_ids:
        try:
            uuid.UUID(uid)
            valid_ids.append(uid)
        except ValueError:
            continue
    if not valid_ids:
        return []

    # Pull just the columns we need for the email payload.
    resp = await (
        supabase.table("users")
        .select("id, name, username")
        .in_("id", valid_ids)
        .execute()
    )
    found = rows(resp)

    # Hash in parallel (bcrypt is CPU-bound; offload via asyncio.to_thread).
    async def _gen_one(user_row: dict) -> tuple[dict, str, str]:
        plain  = _generate_password(12)
        hashed = await asyncio.to_thread(get_password_hash, plain)
        return user_row, plain, hashed

    gathered = await asyncio.gather(
        *[_gen_one(u) for u in found],
        return_exceptions=True,
    )

    # Build the bulk update payload. Use the targeted-column update path
    # rather than UPSERT-replace so we don't accidentally clobber events,
    # details, food, etc.
    creds: list[dict[str, Any]] = []
    update_jobs: list[tuple[str, str]] = []   # (id, new_hash)
    for item in gathered:
        if isinstance(item, BaseException):
            continue
        user_row, plain, hashed = item
        update_jobs.append((str(user_row["id"]), hashed))
        creds.append({
            "name":     user_row.get("name") or "",
            "email":    user_row["username"],
            "password": plain,
        })

    # Apply updates concurrently within reasonable parallelism. We can't
    # do "UPDATE ... WHERE id IN (...)" with different values per row in a
    # single Supabase REST call, so we fan out the per-user writes and
    # await them together — much faster than a sequential loop.
    async def _do_update(uid: str, new_hash: str) -> None:
        await (
            supabase.table("users")
            .update({"password_hash": new_hash})
            .eq("id", uid)
            .execute()
        )

    # Limit fan-out to avoid hammering Supabase's connection pool.
    SEM = asyncio.Semaphore(20)

    async def _bound_update(uid: str, new_hash: str) -> None:
        async with SEM:
            try:
                await _do_update(uid, new_hash)
            except Exception:
                # Drop credential from output if its DB write didn't land
                creds[:] = [c for c in creds if c["email"] != uid]

    await asyncio.gather(*[_bound_update(uid, h) for uid, h in update_jobs])

    return creds


# \u2500\u2500 Manual single-participant enroll \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async def manual_enroll(
    supabase: AsyncClient,
    name: str,
    email: str,
    plain_password: str,
    event_id: str,
    team_mode: str = "none",           # 'none' | 'existing' | 'new'
    existing_team_id: str | None = None,  # preferred: direct ID from lookup
    existing_team_name: str | None = None,
    existing_member_name: str | None = None,  # informational only
    new_team_name: str | None = None,
) -> dict[str, Any]:
    """
    Manually enrol a single participant.

    - Creates the user if the email doesn't exist yet (uses the supplied
      plain-text password which is hashed server-side).
    - If the user already exists, adds the event to their events map
      (raises 409 if they're already enrolled in that event).
    - Handles team assignment:
        * team_mode='none'     \u2192 solo entry, no team
        * team_mode='existing' \u2192 looks up team by name in the event (case-insensitive),
                                  appends user to member_ids
        * team_mode='new'      \u2192 inserts a fresh team row

    Returns a dict with user_id, name, email, password (if new),
    event_name, team_name, is_new_user, message.
    """
    email = (email or "").strip().lower()
    if not email or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email address.")

    name = (name or "").strip() or email.split("@")[0]
    event = await _fetch_event(supabase, event_id)
    event_uuid = event["id"]
    event_name = event["name"]

    # \u2500\u2500 1. Fetch or create user \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    resp = await (
        supabase.table("users")
        .select("*")
        .eq("username", email)
        .limit(1)
        .execute()
    )
    existing_row = first_row(resp)

    is_new_user = existing_row is None
    returned_password: str | None = None
    team_uuid: str | None = None

    if existing_row is not None:
        user = User.from_row(existing_row)
        events_map = dict(user.events or {})
        if event_uuid in events_map:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User '{email}' is already registered for this event.",
            )
        user_id = str(user.id)
    else:
        # Hash the supplied password in a thread so we don't block the event loop.
        hashed_pw = await asyncio.to_thread(get_password_hash, plain_password)
        user_id = str(uuid.uuid4())
        new_user_payload = {
            "id": user_id,
            "username": email,
            "password_hash": hashed_pw,
            "name": name,
            "unstop_id": None,
            "is_attending": False,
            "details": {"email": email, "phone": "", "college": "", "year": "",
                        "branch": "", "gender": "", "city": "", "emergency_contact": ""},
            "events": {},
            "food": {},
            "is_profile_complete": False,
            "cents": 0,
        }
        try:
            await supabase.table("users").insert(new_user_payload).execute()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user: {exc}",
            ) from exc
        returned_password = plain_password
        events_map = {}

    # \u2500\u2500 2. Resolve team \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    resolved_team_name: str | None = None

    if team_mode == "existing":
        # ── Fast path: direct team_id from lookup (no ambiguity) ──────────────
        if existing_team_id:
            t_resp = await (
                supabase.table("teams")
                .select("id, name, member_ids")
                .eq("id", existing_team_id)
                .limit(1)
                .execute()
            )
            t_rows = t_resp.data or []
            if not t_rows:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Team ID '{existing_team_id}' not found.",
                )
            match = t_rows[0]
        else:
            # ── Fallback: name-based search (legacy path) ──────────────────────
            search_name = (existing_team_name or "").strip()
            if not search_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Provide either existing_team_id or existing_team_name.",
                )
            teams_resp = await (
                supabase.table("teams")
                .select("id, name, member_ids")
                .eq("event_id", event_uuid)
                .execute()
            )
            all_teams = teams_resp.data or []
            norm = lambda s: s.strip().lower()
            match = next(
                (t for t in all_teams if norm(t["name"]) == norm(search_name)),
                None,
            ) or next(
                (t for t in all_teams if norm(search_name) in norm(t["name"])),
                None,
            )
            if match is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No team named '{search_name}' found for this event.",
                )

        team_uuid = str(match["id"])
        resolved_team_name = match["name"]

        # Append the new user to member_ids (non-destructive).
        current_members: list[str] = [str(m) for m in (match.get("member_ids") or [])]
        if user_id not in current_members:
            current_members.append(user_id)
            try:
                await (
                    supabase.table("teams")
                    .update({"member_ids": current_members})
                    .eq("id", team_uuid)
                    .execute()
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update team members: {exc}",
                ) from exc

    elif team_mode == "new":
        t_name = (new_team_name or "").strip()
        if not t_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="new_team_name is required when team_mode='new'.",
            )
        team_uuid = str(uuid.uuid4())
        resolved_team_name = t_name
        try:
            await supabase.table("teams").insert({
                "id": team_uuid,
                "name": t_name,
                "event_id": event_uuid,
                "leader_id": user_id,
                "member_ids": [user_id],
            }).execute()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create team: {exc}",
            ) from exc

    # \u2500\u2500 3. Write event entry onto user \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    events_map[event_uuid] = _default_event_entry(team_uuid=team_uuid)
    try:
        await (
            supabase.table("users")
            .update({"events": events_map, "name": name})
            .eq("id", user_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enrol user in event: {exc}",
        ) from exc

    action = "created and enrolled" if is_new_user else "enrolled"
    team_msg = f" in team '{resolved_team_name}'" if resolved_team_name else ""
    return {
        "user_id": user_id,
        "name": name,
        "email": email,
        "password": returned_password,
        "event_name": event_name,
        "team_name": resolved_team_name,
        "is_new_user": is_new_user,
        "message": f"User {action} in '{event_name}'{team_msg}.",
    }

