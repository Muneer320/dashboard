"""
Student-facing coin endpoints.
All routes require a logged-in user (get_current_user).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.core.coins_config import (
    POWER_HOURS,
    TIER_THRESHOLDS,
)
from app.db.supabase_client import first_row, get_supabase, rows
from app.models.user import User
from app.services.coins_service import (
    credit_coins,
    generate_sticker_code,
    get_live_leaderboard,
    get_student_balance,
    get_student_rank,
    write_audit,
)
from app.services.notification_service import notify_student

router = APIRouter()


# ----------------------------- helpers -----------------------------

def _power_hour_status(now: datetime) -> dict[str, Any]:
    """Return active flag + seconds remaining + label for the current Power Hour, if any."""
    now_utc = now.astimezone(timezone.utc)
    hm = now_utc.strftime("%H:%M")
    for window in POWER_HOURS:
        if window["start"] <= hm < window["end"]:
            end_h, end_m = (int(p) for p in window["end"].split(":"))
            end_dt = now_utc.replace(hour=end_h, minute=end_m, second=0, microsecond=0)
            ends_in = max(0, int((end_dt - now_utc).total_seconds()))
            return {
                "active": True,
                "ends_in_seconds": ends_in,
                "label": f"Day {window['day']} Power Hour",
            }
    return {"active": False, "ends_in_seconds": 0, "label": None}


def _tier_status(balance: int) -> dict[str, Any]:
    """Which thresholds the student has crossed, plus the next target."""
    crossed = [tier for tier, t in TIER_THRESHOLDS.items() if balance >= t]
    upcoming = [(tier, t) for tier, t in TIER_THRESHOLDS.items() if balance < t]
    next_tier = min(upcoming, key=lambda kv: kv[1]) if upcoming else None
    return {
        "crossed": crossed,
        "next_tier": next_tier[0] if next_tier else None,
        "next_threshold": next_tier[1] if next_tier else None,
        "remaining_to_next": (next_tier[1] - balance) if next_tier else 0,
    }


# ----------------------------- routes -----------------------------

@router.get("/balance")
async def get_balance(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    balance = await get_student_balance(supabase, user.id)
    rank_info = await get_student_rank(supabase, user.id)
    ph = _power_hour_status(datetime.now(timezone.utc))
    return {
        "balance": balance,
        "rank": rank_info["rank"],
        "total_students": rank_info.get("total_students"),
        "tier_status": _tier_status(balance),
        # next_snapshot_countdown is admin-triggered in this build —
        # there are no preconfigured snapshot times. Returning null lets
        # the frontend hide the timer until ops sets a schedule.
        "next_snapshot_countdown": None,
        "power_hour_active": ph["active"],
        "power_hour_ends_in_seconds": ph["ends_in_seconds"],
    }


@router.get("/history")
async def get_history(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    resp = await (
        supabase.table("coins_ledger")
        .select("*")
        .eq("student_id", str(user.id))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return rows(resp)


@router.get("/leaderboard")
async def get_leaderboard(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    top = await get_live_leaderboard(supabase, limit=100)
    me = next((entry for entry in top if entry["student_id"] == str(user.id)), None)
    if me is None:
        # Outside top 100 (or no ledger entries yet). Use the authenticated
        # User row directly for display so the pinned "me" row still shows
        # name/username.
        rank_info = await get_student_rank(supabase, user.id)
        me = {
            "student_id": str(user.id),
            "rank": rank_info["rank"],
            "coins": rank_info["coins"],
            "distinct_sources": rank_info["distinct_sources"],
            "name": user.name,
            "username": user.username,
        }
    return {"top": top, "me": me, "as_of": datetime.now(timezone.utc).isoformat()}


@router.get("/power-hour-status")
async def power_hour_status_route() -> dict[str, Any]:
    return _power_hour_status(datetime.now(timezone.utc))


class DisputeIn(BaseModel):
    ledger_entry_id: str = Field(..., description="UUID of the ledger entry being disputed")
    description: str = Field(..., min_length=1)


@router.post("/dispute")
async def open_dispute(
    payload: DisputeIn,
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    # Verify the ledger entry exists and belongs to this user
    entry_resp = await (
        supabase.table("coins_ledger")
        .select("id, student_id")
        .eq("id", payload.ledger_entry_id)
        .limit(1)
        .execute()
    )
    entry = first_row(entry_resp)
    if entry is None or entry["student_id"] != str(user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger entry not found for this user",
        )

    insert_resp = await supabase.table("dispute_tickets").insert({
        "student_id": str(user.id),
        "ledger_entry_id": payload.ledger_entry_id,
        "description": payload.description,
        "status": "open",
    }).execute()
    ticket = rows(insert_resp)[0]

    await write_audit(
        supabase,
        actor_id=user.id,
        actor_role="user",
        action="DISPUTE_OPENED",
        entity_type="dispute_tickets",
        entity_id=ticket["id"],
        reason=payload.description[:500],
    )
    return ticket


@router.post("/redeem-sticker")
async def redeem_sticker(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    balance = await get_student_balance(supabase, user.id)
    if balance < TIER_THRESHOLDS["STICKER"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need {TIER_THRESHOLDS['STICKER']} coins to redeem sticker",
        )

    # One sticker per student — block re-redemption
    existing_resp = await (
        supabase.table("reward_redemptions")
        .select("id, status")
        .eq("student_id", str(user.id))
        .eq("tier", "STICKER")
        .in_("status", ["pending", "claimed"])
        .limit(1)
        .execute()
    )
    if first_row(existing_resp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sticker already redeemed",
        )

    try:
        result = await generate_sticker_code(supabase, user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await write_audit(
        supabase,
        actor_id=user.id,
        actor_role="user",
        action="CODE_GENERATED",
        entity_type="reward_redemptions",
        entity_id=result["redemption_id"],
        after_state={"tier": "STICKER"},
    )
    return result


# ----------------------------- surprise drops -----------------------------

@router.get("/surprise-drops/active")
async def active_surprise_drops(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()
    resp = await (
        supabase.table("surprise_drops")
        .select("id, criteria, reward_tier, max_winners, winners_so_far, coin_reward, window_end")
        .eq("status", "active")
        .gte("window_end", now_iso)
        .execute()
    )
    return rows(resp)


class DropClaimIn(BaseModel):
    drop_id: str


@router.post("/surprise-drops/claim")
async def claim_surprise_drop(
    payload: DropClaimIn,
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    drop_resp = await (
        supabase.table("surprise_drops")
        .select("*")
        .eq("id", payload.drop_id)
        .limit(1)
        .execute()
    )
    drop = first_row(drop_resp)
    if drop is None:
        raise HTTPException(status_code=404, detail="Drop not found")
    if drop["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Drop is {drop['status']}")

    now = datetime.now(timezone.utc)
    window_end = datetime.fromisoformat(drop["window_end"].replace("Z", "+00:00"))
    if window_end.tzinfo is None:
        window_end = window_end.replace(tzinfo=timezone.utc)
    if now > window_end:
        raise HTTPException(status_code=400, detail="Drop window closed")

    if drop["winners_so_far"] >= drop["max_winners"]:
        raise HTTPException(status_code=400, detail="All slots taken")

    # Block double-claim by the same student for the same drop.
    existing = await (
        supabase.table("coins_ledger")
        .select("id")
        .eq("student_id", str(user.id))
        .eq("source_type", "SURPRISE_DROP")
        .filter("metadata->>surprise_drop_id", "eq", payload.drop_id)
        .limit(1)
        .execute()
    )
    if first_row(existing):
        raise HTTPException(status_code=400, detail="Already claimed")

    coins = drop.get("coin_reward") or 0
    if coins <= 0:
        raise HTTPException(
            status_code=400,
            detail="This drop awards merch — visit the booth to claim",
        )

    # Increment winners_so_far. Read-modify-write race window exists; for
    # high contention this should move to a Postgres RPC. Until then, the
    # pre-check above + this update narrows the window enough for the
    # expected event-day load.
    await (
        supabase.table("surprise_drops")
        .update({"winners_so_far": drop["winners_so_far"] + 1})
        .eq("id", payload.drop_id)
        .execute()
    )

    ledger = await credit_coins(
        supabase,
        student_id=user.id,
        source_type="SURPRISE_DROP",
        coins=coins,
        verified_by=None,
        metadata={"surprise_drop_id": payload.drop_id},
    )
    await notify_student(
        str(user.id),
        "surprise_drop_won",
        {"reward": f"{coins} coins"},
    )
    return {"ledger_entry": ledger, "coins_credited": coins}
