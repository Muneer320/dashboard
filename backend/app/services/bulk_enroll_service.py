"""
Bulk-enroll service.

Takes a CSV or XLSX roster (exported from Unstop / registration forms) plus a
target event_id and:
  - Creates a ``users`` row for every email we haven't seen before (with a
    fresh 12-char alphanumeric password, hashed into ``password_hash``), and
    enrols them in the event.
  - Appends the event to ``users.events`` for users whose email already
    exists, unless they're already registered for this event (duplicate).
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

    # ── Upsert teams (only real teams, not solo participants) ─────────────────
    if teams_to_upsert:
        teams_list = list(teams_to_upsert.values())
        for i in range(0, len(teams_list), 200):
            try:
                await supabase.table("teams").upsert(
                    teams_list[i : i + 200], on_conflict="id"
                ).execute()
            except Exception as exc:
                errors_detail.append({
                    "row": -1,
                    "email": "teams-upsert",
                    "reason": f"Team batch upsert failed: {exc}",
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
                # Already registered for this event — skip.
                duplicates_detail.append({"row": row_idx, "email": email})
                continue

            # User exists but not enrolled in this event — add the event.
            _entry = _default_event_entry(team_uuid=team_uuid)
            events_map[event_uuid] = _entry

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

    # ── Update existing users' events + team_id (targeted columns only) ───────
    for upd in existing_user_updates:
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
                "reason": f"Failed to update existing user: {exc}",
            })

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
