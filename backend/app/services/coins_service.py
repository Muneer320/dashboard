"""
Core coins ledger service.
All coin operations go through here.
The ledger is append-only — never update or delete.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from supabase import AsyncClient

from app.core.coins_config import (
    SNAPSHOT_TIERS,
    STICKER_CODE_TTL_MINUTES,
    TIER_RANK_CUTOFFS,
    TIER_THRESHOLDS,
    VERIFICATION_SLA_EVENT_DAY,
)
from app.db.supabase_client import first_row, rows


# ----------------------------- balance & rank -----------------------------

async def get_student_balance(supabase: AsyncClient, student_id: UUID | str) -> int:
    """Live balance = sum of all verified ledger entries."""
    resp = await (
        supabase.table("coins_ledger")
        .select("coins")
        .eq("student_id", str(student_id))
        .eq("status", "verified")
        .execute()
    )
    return sum(row["coins"] for row in rows(resp))


async def get_student_rank(
    supabase: AsyncClient, student_id: UUID | str
) -> dict[str, Any]:
    """Returns student's current rank and surrounding context."""
    leaderboard = await get_live_leaderboard(supabase, limit=None)
    sid = str(student_id)
    for idx, entry in enumerate(leaderboard):
        if entry["student_id"] == sid:
            return {
                "rank": idx + 1,
                "total_students": len(leaderboard),
                "coins": entry["coins"],
                "distinct_sources": entry["distinct_sources"],
            }
    return {"rank": None, "total_students": len(leaderboard), "coins": 0, "distinct_sources": 0}


async def get_live_leaderboard(
    supabase: AsyncClient, limit: int | None = 100
) -> list[dict[str, Any]]:
    """
    Compute live leaderboard from ledger.
    Tiebreaker cascade:
      1. Higher coin total
      2. More distinct earning sources
      3. Earlier last-entry timestamp (the one who got there first wins)
    """
    resp = await (
        supabase.table("coins_ledger")
        .select("student_id, coins, source_type, created_at")
        .eq("status", "verified")
        .execute()
    )

    students: dict[str, dict[str, Any]] = {}
    for row in rows(resp):
        sid = row["student_id"]
        bucket = students.get(sid)
        if bucket is None:
            students[sid] = {
                "student_id": sid,
                "coins": 0,
                "distinct_sources": set(),
                "last_entry_at": row["created_at"],
            }
            bucket = students[sid]
        bucket["coins"] += row["coins"]
        bucket["distinct_sources"].add(row["source_type"])
        if row["created_at"] > bucket["last_entry_at"]:
            bucket["last_entry_at"] = row["created_at"]

    ranked = sorted(
        students.values(),
        key=lambda s: (
            -s["coins"],
            -len(s["distinct_sources"]),
            s["last_entry_at"],
        ),
    )

    for s in ranked:
        s["distinct_sources"] = len(s["distinct_sources"])

    out = ranked[:limit] if limit else ranked

    # Hydrate display names — one round-trip for the slice we'll return.
    if out:
        ids = [s["student_id"] for s in out]
        users_resp = await (
            supabase.table("users")
            .select("id, name, username")
            .in_("id", ids)
            .execute()
        )
        name_map = {u["id"]: u for u in rows(users_resp)}
        for s in out:
            u = name_map.get(s["student_id"]) or {}
            s["name"] = u.get("name")
            s["username"] = u.get("username")

    return out


# ----------------------------- ledger writes -----------------------------

async def credit_coins(
    supabase: AsyncClient,
    *,
    student_id: UUID | str,
    source_type: str,
    coins: int,
    verified_by: UUID | str | None,
    reference_url: str | None = None,
    power_hour_applied: bool = False,
    published_timestamp: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Write a verified coin entry to the ledger.
    Returns the created ledger row.

    Side-effect: when `coins` is strictly positive, the student's
    `users.cents` column is bumped by the same amount so the existing
    leaderboard (which reads `users.cents`) stays in sync with the
    ledger. Negative entries — reversals, redemptions, negative manual
    adjustments — never decrement `users.cents`; the leaderboard
    reflects only positive earnings.
    """
    entry = {
        "student_id": str(student_id),
        "source_type": source_type,
        "coins": coins,
        "status": "verified",
        "reference_url": reference_url,
        "power_hour_applied": power_hour_applied,
        "verified_by": str(verified_by) if verified_by else None,
        "published_timestamp": published_timestamp.isoformat() if published_timestamp else None,
        "metadata": metadata or {},
    }
    resp = await supabase.table("coins_ledger").insert(entry).execute()
    inserted = rows(resp)[0]

    if coins > 0:
        await _bump_user_cents(supabase, student_id, coins)

    return inserted


async def _bump_user_cents(
    supabase: AsyncClient, student_id: UUID | str, delta: int
) -> None:
    """Add `delta` to `users.cents` for this student. Read-then-write —
    PostgREST does not expose a server-side atomic increment, so we
    accept the small race window; the ledger remains the source of
    truth and any drift can be reconciled from it."""
    sid = str(student_id)
    current_resp = await (
        supabase.table("users")
        .select("cents")
        .eq("id", sid)
        .limit(1)
        .execute()
    )
    row = first_row(current_resp)
    if row is None:
        return
    new_cents = int(row.get("cents") or 0) + delta
    await (
        supabase.table("users")
        .update({"cents": new_cents})
        .eq("id", sid)
        .execute()
    )


async def post_reversal(
    supabase: AsyncClient,
    *,
    original_entry_id: UUID | str,
    student_id: UUID | str,
    reason: str,
    grace_hours: int = 24,
    actor_id: UUID | str | int | None = None,
    actor_role: str = "system",
) -> dict[str, Any]:
    """
    Post a reversal entry. Student has grace_hours to repost.
    Writes a REVERSAL_POSTED audit_log entry.
    """
    original_resp = await (
        supabase.table("coins_ledger")
        .select("*")
        .eq("id", str(original_entry_id))
        .limit(1)
        .execute()
    )
    original = first_row(original_resp)
    if original is None:
        raise ValueError("original_entry_not_found")
    original_coins = original["coins"]

    grace_deadline = (
        datetime.now(timezone.utc) + timedelta(hours=grace_hours)
    ).isoformat()

    reversal = {
        "student_id": str(student_id),
        "source_type": "REVERSAL",
        "coins": -original_coins,
        "status": "verified",
        "reference_entry_id": str(original_entry_id),
        "grace_deadline": grace_deadline,
        "reason": reason,
    }
    resp = await supabase.table("coins_ledger").insert(reversal).execute()
    inserted = rows(resp)[0]

    await write_audit(
        supabase,
        actor_id=actor_id if actor_id is not None else "system",
        actor_role=actor_role,
        action="REVERSAL_POSTED",
        entity_type="coins_ledger",
        entity_id=inserted["id"],
        after_state={
            "original_entry_id": str(original_entry_id),
            "coins": -original_coins,
            "grace_deadline": grace_deadline,
        },
        reason=reason,
    )
    return inserted


# ----------------------------- sticker codes -----------------------------

async def generate_sticker_code(
    supabase: AsyncClient, student_id: UUID | str
) -> dict[str, Any]:
    """Thin wrapper kept for call-site compatibility — delegates to reserve_reward."""
    return await reserve_reward(supabase, student_id=student_id, tier="BADGE_STICKER")


async def reserve_reward(
    supabase: AsyncClient,
    *,
    student_id: UUID | str,
    tier: str,
) -> dict[str, Any]:
    """
    Reserve a reward tier for a student: check inventory, insert a
    pending row. No code is generated — the student redeems at the
    booth by showing their QR (student UUID).

    `reward_inventory.allocated` is NOT touched here — it now tracks
    only items physically handed out. Availability is the live count of
    pending + claimed reservations against total_stock - surprise_reserve.

    Race-condition note: supabase-py / PostgREST does not expose SELECT FOR
    UPDATE. Robust fix is a Postgres RPC wrapping read+write in one
    transaction. Until then, read-then-write is acceptable at fest scale.
    """
    inventory_resp = await (
        supabase.table("reward_inventory")
        .select("*")
        .eq("tier", tier)
        .limit(1)
        .execute()
    )
    inv = first_row(inventory_resp)
    if inv is None:
        raise ValueError(f"inventory_missing:{tier}")

    # Live count of outstanding reservations for this tier.
    reserved_resp = await (
        supabase.table("reward_redemptions")
        .select("id")
        .eq("tier", tier)
        .in_("status", ["pending", "claimed"])
        .execute()
    )
    reserved_count = len(rows(reserved_resp))

    available = inv["total_stock"] - reserved_count - inv["surprise_drop_reserve"]
    if available <= 0:
        raise ValueError(f"out_of_stock:{tier}")

    resp = await (
        supabase.table("reward_redemptions")
        .insert({"student_id": str(student_id), "tier": tier, "status": "pending"})
        .execute()
    )
    return {"redemption_id": rows(resp)[0]["id"]}


# ----------------------------- snapshots -----------------------------

async def take_leaderboard_snapshot(
    supabase: AsyncClient,
    *,
    snapshot_type: str,
    taken_by: UUID | str,
    force: bool = False,
    force_reason: str | None = None,
) -> dict[str, Any]:
    """
    Lock the leaderboard at a point in time.
    Applies coin threshold gates and tiebreaker cascade.
    Signs with SHA256 hash. Immutable after creation.
    """
    if snapshot_type not in SNAPSHOT_TIERS:
        raise ValueError(f"unknown_snapshot_type:{snapshot_type}")

    if not force and await _check_stale_queue(supabase):
        raise ValueError("verification_sla_breached — use force=True with reason")

    leaderboard = await get_live_leaderboard(supabase, limit=None)

    tier = SNAPSHOT_TIERS[snapshot_type]
    rank_cutoff = TIER_RANK_CUTOFFS[tier]
    coin_threshold = TIER_THRESHOLDS[tier]

    eligible = [
        s for s in leaderboard[:rank_cutoff]
        if s["coins"] >= coin_threshold
    ]

    snapshot_data = {
        "snapshot_type": snapshot_type,
        "taken_at": datetime.now(timezone.utc).isoformat(),
        "leaderboard": leaderboard[:100],
        "eligible_student_ids": [s["student_id"] for s in eligible],
    }
    data_str = json.dumps(snapshot_data, sort_keys=True, default=str)
    signed_hash = hashlib.sha256(data_str.encode()).hexdigest()

    record = {
        "snapshot_type": snapshot_type,
        "snapshot_data": snapshot_data,
        "merch_eligibility": {
            "eligible": [s["student_id"] for s in eligible],
            "tier": tier,
            "cutoff": rank_cutoff,
            "threshold": coin_threshold,
        },
        "signed_hash": signed_hash,
        "taken_by": str(taken_by),
        "is_locked": True,
    }

    resp = await supabase.table("leaderboard_snapshots").insert(record).execute()
    inserted = rows(resp)[0]

    await write_audit(
        supabase,
        actor_id=taken_by,
        actor_role="prm_lead",
        action="SNAPSHOT_TAKEN",
        entity_type="leaderboard_snapshots",
        entity_id=inserted["id"],
        reason=force_reason if force else "scheduled_snapshot",
        after_state={"snapshot_type": snapshot_type, "eligible_count": len(eligible)},
    )

    return inserted


def verify_snapshot_hash(snapshot_row: dict[str, Any]) -> bool:
    """Recompute the signed_hash and compare. Use on read to detect tampering."""
    data_str = json.dumps(snapshot_row["snapshot_data"], sort_keys=True, default=str)
    expected = hashlib.sha256(data_str.encode()).hexdigest()
    return expected == snapshot_row.get("signed_hash")


# ----------------------------- helpers -----------------------------

async def _check_stale_queue(supabase: AsyncClient) -> bool:
    """Returns True if any submission has breached SLA."""
    cutoff = (
        datetime.now(timezone.utc) - timedelta(minutes=VERIFICATION_SLA_EVENT_DAY)
    ).isoformat()
    resp = await (
        supabase.table("ugc_submissions")
        .select("id")
        .eq("status", "admin_queued")
        .lt("submitted_at", cutoff)
        .limit(1)
        .execute()
    )
    return len(rows(resp)) > 0


async def write_audit(
    supabase: AsyncClient,
    *,
    actor_id: UUID | str,
    actor_role: str,
    action: str,
    entity_type: str | None = None,
    entity_id: UUID | str | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    reason: str | None = None,
) -> None:
    await supabase.table("audit_log").insert({
        "actor_id": str(actor_id),
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id else None,
        "before_state": before_state,
        "after_state": after_state,
        "reason": reason,
    }).execute()
