"""
Booth tool endpoints. Used by booth_volunteer accounts on event day to
award coins to students for on-ground micro-events.

Idempotency: every award carries a client-generated UUID so retries
(network flakes, offline-then-online) do not double-credit. Duplicates
return 200 with `duplicate=True`, never 409.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.api.deps import get_booth_volunteer
from app.core.coins_config import COIN_VALUES
from app.db.supabase_client import first_row, get_supabase, rows
from app.services.coins_service import credit_coins, write_audit
from app.services.notification_service import notify_student

router = APIRouter()


# ----------------------------- helpers -----------------------------

# A booth is identified by a `booth_id` claim in the JWT. The mapping
# from booth_id → source_type lives here so the spec stays single-sourced.
# Extend as new booths are introduced.
BOOTH_SOURCE_MAP: dict[str, str] = {
    "AR_FILTER":      "AR_FILTER",
    "SCAVENGER":      "SCAVENGER_HUNT",
    "RAZORPAY":       "RAZORPAY_PITCH",
    "ECO_EXCHANGE":   "ECO_EXCHANGE",
    "EVENT_WIN":      "EVENT_WIN",
    "ECO_DESIGN_WIN": "ECO_DESIGN_WIN",
}


def _booth_source_type(booth_id: str) -> str:
    src = BOOTH_SOURCE_MAP.get(booth_id)
    if src is None:
        raise HTTPException(
            status_code=400,
            detail=f"booth_id '{booth_id}' is not mapped to a source_type",
        )
    return src


# ----------------------------- award -----------------------------

class BoothAwardIn(BaseModel):
    student_id: str
    client_uuid: str = Field(..., min_length=8, description="Device-generated idempotency key")


async def _existing_award(
    supabase: AsyncClient, client_uuid: str
) -> dict[str, Any] | None:
    """Look up a prior award by client_uuid (stored in metadata)."""
    # supabase-py JSONB-eq filter: use the `->>` arrow via filter
    resp = await (
        supabase.table("coins_ledger")
        .select("*")
        .filter("metadata->>client_uuid", "eq", client_uuid)
        .limit(1)
        .execute()
    )
    return first_row(resp)


async def _already_awarded_today(
    supabase: AsyncClient, student_id: str, booth_id: str, today_iso: str
) -> bool:
    resp = await (
        supabase.table("coins_ledger")
        .select("id")
        .eq("student_id", student_id)
        .filter("metadata->>booth_id", "eq", booth_id)
        .gte("created_at", today_iso)
        .limit(1)
        .execute()
    )
    return first_row(resp) is not None


@router.post("/award")
async def booth_award(
    payload: BoothAwardIn,
    auth: dict = Depends(get_booth_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    admin = auth["admin"]
    booth_id: str = auth["booth_id"]
    source_type = _booth_source_type(booth_id)
    coins = COIN_VALUES.get(source_type, 0)
    if coins == 0:
        raise HTTPException(status_code=400, detail=f"No coin value for {source_type}")

    # 1. Idempotency: same client_uuid → return prior award silently with 200.
    prior = await _existing_award(supabase, payload.client_uuid)
    if prior is not None:
        return {"success": True, "duplicate": True, "ledger_entry": prior}

    # 2. Lookup the student
    student_resp = await (
        supabase.table("users")
        .select("id, name")
        .eq("id", payload.student_id)
        .limit(1)
        .execute()
    )
    student = first_row(student_resp)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    # 3. One award per student per booth per day
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    if await _already_awarded_today(supabase, payload.student_id, booth_id, today_start):
        raise HTTPException(
            status_code=400,
            detail="Student already awarded by this booth today",
        )

    ledger = await credit_coins(
        supabase,
        student_id=payload.student_id,
        source_type=source_type,
        coins=coins,
        verified_by=admin.uid,
        metadata={
            "client_uuid": payload.client_uuid,
            "booth_id": booth_id,
            "volunteer_uid": admin.uid,
        },
    )
    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="BOOTH_AWARD",
        entity_type="coins_ledger",
        entity_id=ledger["id"],
        after_state={
            "student_id": payload.student_id,
            "booth_id": booth_id,
            "coins": coins,
        },
    )
    await notify_student(
        payload.student_id,
        "booth_award",
        {"coins": coins, "source": booth_id},
    )
    return {
        "success": True,
        "duplicate": False,
        "student_name": student["name"],
        "coins_awarded": coins,
        "ledger_entry": ledger,
    }


# ----------------------------- offline sync -----------------------------

class OfflineAward(BaseModel):
    student_id: str
    client_uuid: str = Field(..., min_length=8)
    awarded_at: str | None = None


class BoothSyncIn(BaseModel):
    awards: list[OfflineAward]


@router.post("/sync")
async def booth_sync(
    payload: BoothSyncIn,
    auth: dict = Depends(get_booth_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    admin = auth["admin"]
    booth_id: str = auth["booth_id"]
    source_type = _booth_source_type(booth_id)
    coins = COIN_VALUES.get(source_type, 0)
    if coins == 0:
        raise HTTPException(status_code=400, detail=f"No coin value for {source_type}")

    processed = 0
    duplicates = 0
    skipped = []
    for award in payload.awards:
        prior = await _existing_award(supabase, award.client_uuid)
        if prior is not None:
            duplicates += 1
            continue

        student_resp = await (
            supabase.table("users")
            .select("id")
            .eq("id", award.student_id)
            .limit(1)
            .execute()
        )
        if first_row(student_resp) is None:
            skipped.append({"client_uuid": award.client_uuid, "reason": "student_not_found"})
            continue

        ledger = await credit_coins(
            supabase,
            student_id=award.student_id,
            source_type=source_type,
            coins=coins,
            verified_by=admin.uid,
            metadata={
                "client_uuid": award.client_uuid,
                "booth_id": booth_id,
                "volunteer_uid": admin.uid,
                "offline_sync": True,
                "awarded_at": award.awarded_at,
            },
        )
        await write_audit(
            supabase,
            actor_id=admin.uid,
            actor_role=admin.role.value,
            action="BOOTH_AWARD",
            entity_type="coins_ledger",
            entity_id=ledger["id"],
            after_state={
                "student_id": award.student_id,
                "booth_id": booth_id,
                "coins": coins,
                "offline_sync": True,
            },
        )
        await notify_student(
            award.student_id,
            "booth_award",
            {"coins": coins, "source": booth_id},
        )
        processed += 1

    return {
        "processed": processed,
        "duplicates": duplicates,
        "skipped": skipped,
    }


# ----------------------------- student lookup -----------------------------

@router.get("/student/{student_id}")
async def booth_student(
    student_id: str,
    auth: dict = Depends(get_booth_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    booth_id: str = auth["booth_id"]

    # Accept either a full UUID or the legacy "ASCENT-XXXXXXXX" label that
    # the older dashboard QR encodes (just the first 8 hex chars of the user
    # id, uppercased). Resolve the legacy label by prefix match.
    lookup_id = student_id
    upper = student_id.strip().upper()
    if upper.startswith("ASCENT-") and len(upper) > len("ASCENT-"):
        prefix = upper[len("ASCENT-"):].lower()
        if all(c in "0123456789abcdef" for c in prefix):
            prefix_resp = await (
                supabase.table("users")
                .select("id")
                .ilike("id", f"{prefix}%")
                .limit(2)
                .execute()
            )
            matches = rows(prefix_resp)
            if len(matches) == 1:
                lookup_id = matches[0]["id"]
            elif len(matches) == 0:
                raise HTTPException(status_code=404, detail="Student not found")
            else:
                raise HTTPException(
                    status_code=409,
                    detail="QR prefix matched multiple students — ask student to open My QR.",
                )

    student_resp = await (
        supabase.table("users")
        .select("id, name, details")
        .eq("id", lookup_id)
        .limit(1)
        .execute()
    )
    student = first_row(student_resp)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    student_id = student["id"]  # canonical full UUID for downstream queries

    balance_resp = await (
        supabase.table("coins_ledger")
        .select("coins")
        .eq("student_id", student_id)
        .eq("status", "verified")
        .execute()
    )
    balance = sum(r["coins"] for r in rows(balance_resp))

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    awarded_today = await _already_awarded_today(
        supabase, student_id, booth_id, today_start
    )

    return {
        "id": student["id"],
        "name": student["name"],
        "balance": balance,
        "already_awarded_this_booth": awarded_today,
    }


# ----------------------------- volunteer self -----------------------------

@router.get("/me")
async def booth_me(auth: dict = Depends(get_booth_volunteer)) -> dict[str, Any]:
    """Return the current booth volunteer's identity + assigned booth."""
    admin = auth["admin"]
    return {
        "uid": admin.uid,
        "username": admin.username,
        "name": admin.name,
        "role": admin.role.value,
        "booth_id": auth["booth_id"],
    }


# ----------------------------- award history -----------------------------

@router.get("/awards")
async def booth_awards(
    auth: dict = Depends(get_booth_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
    limit: int = Query(50, le=200),
    today_only: bool = Query(True),
) -> list[dict[str, Any]]:
    """Awards made by this volunteer (optionally limited to today). Includes
    student name + booth_id stamped on each ledger row."""
    admin = auth["admin"]
    booth_id: str = auth["booth_id"]

    q = (
        supabase.table("coins_ledger")
        .select("id, student_id, coins, source_type, created_at, metadata")
        .eq("verified_by", admin.uid)
        .filter("metadata->>booth_id", "eq", booth_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if today_only:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        q = q.gte("created_at", today_start)
    resp = await q.execute()
    awards = rows(resp)
    if not awards:
        return []

    # Join student names in a single round-trip
    ids = list({a["student_id"] for a in awards})
    users_resp = await (
        supabase.table("users")
        .select("id, name, username")
        .in_("id", ids)
        .execute()
    )
    name_map = {u["id"]: u for u in rows(users_resp)}
    for a in awards:
        u = name_map.get(a["student_id"]) or {}
        a["student_name"] = u.get("name")
        a["student_username"] = u.get("username")
    return awards


# ----------------------------- search fallback -----------------------------

@router.get("/search")
async def booth_search(
    q: str = Query(..., min_length=2),
    auth: dict = Depends(get_booth_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    admin = auth["admin"]
    # ILIKE on name or username
    pattern = f"%{q}%"
    resp = await (
        supabase.table("users")
        .select("id, name, username")
        .or_(f"name.ilike.{pattern},username.ilike.{pattern}")
        .limit(20)
        .execute()
    )
    results = rows(resp)

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="BOOTH_MANUAL_LOOKUP",
        entity_type="users",
        entity_id=None,
        reason=f"query={q}",
        after_state={"result_count": len(results)},
    )
    return results
