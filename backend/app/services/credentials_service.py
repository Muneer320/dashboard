"""
Credentials-request service. Supabase-backed.

A given email may only hold **one** active request at a time. "Active" means
status in ('pending', 'approved') — i.e. anything that hasn't been rejected.
Submitting again while an active request exists raises
``DuplicateCredentialsRequest``. A rejected email is free to resubmit.
"""

from __future__ import annotations

import asyncio
import random
import secrets
import string
import uuid

from fastapi import HTTPException, status as http_status
from supabase import AsyncClient

from app.core.security import get_password_hash
from app.db.supabase_client import first_row, rows

# Statuses that count as "already submitted — don't accept another".
ACTIVE_STATUSES = ("pending", "approved")

# Valid status values a row can hold — enforced on PATCH.
ALLOWED_STATUSES = ("pending", "approved", "rejected")


def _generate_ticket_id() -> str:
    """Generate a short human-readable ticket ID like ASC-482910."""
    digits = "".join(random.choices(string.digits, k=6))
    return f"ASC-{digits}"


async def _allocate_unique_ticket_id(supabase: AsyncClient) -> str:
    """
    Generate a ticket_id that isn't already taken. 6 digits = 1M ids, so
    collisions are extremely rare, but loop defensively so we never try to
    persist a duplicate.

    Note: without SQL transactions two concurrent requests could both allocate
    the same free ticket_id. The unique index on the column still guarantees
    at-most-one wins the insert; callers should surface an error if the
    follow-up insert raises because of that.
    """
    for _ in range(10):
        candidate = _generate_ticket_id()
        resp = await (
            supabase.table("requested_members")
            .select("id")
            .eq("ticket_id", candidate)
            .limit(1)
            .execute()
        )
        if first_row(resp) is None:
            return candidate
    raise RuntimeError("could not allocate a unique ticket_id after 10 tries")


async def _find_active_request(
    supabase: AsyncClient, email: str
) -> dict | None:
    """Return any pending/approved request already on file for this email."""
    resp = await (
        supabase.table("requested_members")
        .select("*")
        .eq("email", email)
        .in_("status", list(ACTIVE_STATUSES))
        .limit(1)
        .execute()
    )
    return first_row(resp)


class DuplicateCredentialsRequest(Exception):
    """Raised when the email already has an active (pending/approved) request."""

    def __init__(self, ticket_id: str, status: str):
        self.ticket_id = ticket_id
        self.status = status
        super().__init__(
            f"Credentials request already exists for this email "
            f"(ticket {ticket_id}, status {status})"
        )


async def create_credentials_request(
    supabase: AsyncClient,
    name: str,
    college: str,
    email: str,
    phone: str,
    events_of_interest: list[str],
    note: str | None,
) -> dict:
    """
    Persist a credential request and return a ticket reference.

    Raises ``DuplicateCredentialsRequest`` if this email already has a
    pending/approved request — the route layer converts that to a 409.
    """
    # 1. Guard: one active request per email.
    existing = await _find_active_request(supabase, email)
    if existing is not None:
        raise DuplicateCredentialsRequest(
            ticket_id=existing["ticket_id"],
            status=existing["status"],
        )

    # 2. Allocate a stable ticket_id up front and store it on the row.
    ticket_id = await _allocate_unique_ticket_id(supabase)

    payload = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "name": name,
        "college": college,
        "email": email,
        "phone": phone,
        "areas_of_interest": events_of_interest,
        "description": note,
        "status": "pending",
    }
    resp = await (
        supabase.table("requested_members")
        .insert(payload)
        .execute()
    )
    row = first_row(resp) or payload

    return {
        "ticket_id": row["ticket_id"],
        "status": "pending_verify",
    }


# ── Admin review helpers ──────────────────────────────────────────────────────

def _row_to_admin_dict(row: dict) -> dict:
    """Shape a requested_members row for admin-panel consumption."""
    return {
        "id": str(row["id"]),
        "ticket_id": row.get("ticket_id") or "",
        "name": row.get("name") or "",
        "college": row.get("college") or "",
        "email": row.get("email") or "",
        "phone": row.get("phone") or "",
        "areas_of_interest": list(row.get("areas_of_interest") or []),
        "description": row.get("description"),
        "status": row.get("status") or "pending",
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


async def list_requested_members(
    supabase: AsyncClient,
    status_filter: str | None = None,
) -> list[dict]:
    """
    Return every credentials request, newest first. Optionally filter by
    status — the admin tab uses this to show Pending / Approved / Rejected
    buckets.
    """
    query = supabase.table("requested_members").select("*")
    if status_filter:
        if status_filter not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter. Must be one of {ALLOWED_STATUSES}.",
            )
        query = query.eq("status", status_filter)

    resp = await query.order("created_at", desc=True).execute()
    return [_row_to_admin_dict(r) for r in rows(resp)]


async def update_requested_member_status(
    supabase: AsyncClient,
    request_id: str,
    new_status: str,
) -> dict:
    """
    Move a request into approved/rejected (or back to pending). Returns the
    updated row. 404 if the row doesn't exist.
    """
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of {ALLOWED_STATUSES}.",
        )

    try:
        uuid.UUID(request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid request id",
        ) from exc

    # First fetch the existing request to check its previous status
    resp = await supabase.table("requested_members").select("*").eq("id", request_id).execute()
    existing_req = first_row(resp)
    if existing_req is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Requested member not found",
        )

    old_status = existing_req.get("status")

    resp = await (
        supabase.table("requested_members")
        .update({"status": new_status})
        .eq("id", request_id)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Requested member not found",
        )

    # If transitioning to 'approved' and wasn't already approved, create the user
    if new_status == "approved" and old_status != "approved":
        email = existing_req.get("email")
        if email:
            user_resp = await supabase.table("users").select("id").eq("username", email).execute()
            if not first_row(user_resp):
                plain_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
                hashed_pw = await asyncio.to_thread(get_password_hash, plain_password)

                user_payload = {
                    "id": str(uuid.uuid4()),
                    "username": email,
                    "password_hash": hashed_pw,
                    "name": existing_req.get("name", ""),
                    "unstop_id": None,
                    "is_attending": False,
                    "details": {
                        "email": email,
                        "phone": existing_req.get("phone", ""),
                        "college": existing_req.get("college", ""),
                        "year": "",
                        "branch": "",
                        "gender": "",
                        "city": "",
                        "emergency_contact": "",
                    },
                    "events": {},
                    "food": {},
                    "is_profile_complete": False,
                    "cents": 0,
                }
                try:
                    await supabase.table("users").insert(user_payload).execute()
                    
                    # Update description to store the generated password
                    new_desc = (existing_req.get("description") or "").strip()
                    if new_desc:
                        new_desc += f"\n\n[System] Generated Password: {plain_password}"
                    else:
                        new_desc = f"[System] Generated Password: {plain_password}"
                        
                    await supabase.table("requested_members").update({"description": new_desc}).eq("id", request_id).execute()
                    row["description"] = new_desc
                except Exception:
                    pass

    return _row_to_admin_dict(row)
