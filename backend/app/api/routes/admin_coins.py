"""
Admin endpoints for the Sidequest coins system.

Role tiers (low → high):
  prm_volunteer  → can approve/reject UGC queue
  prm_lead       → + manual-adjust, snapshots, surprise drops, engagement,
                    dispute resolution
  ops_lead       → + audit log read access
  admin          → universal override

Routes that require prm_lead or above are marked `*` in the spec.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.api.deps import (
    get_ops_lead_or_above,
    get_prm_lead_or_above,
    get_prm_volunteer_or_above,
)
from app.core.coins_config import (
    COIN_VALUES,
    ENGAGEMENT_CAP,
    ENGAGEMENT_COMMENT_COINS,
    ENGAGEMENT_LIKE_COINS,
    ENGAGEMENT_REPOST_COINS,
    VERIFICATION_SLA_EVENT_DAY,
)
from app.db.supabase_client import first_row, get_supabase, rows
from app.models.admin import Admin
from app.services.coins_service import (
    credit_coins,
    get_live_leaderboard,
    take_leaderboard_snapshot,
    write_audit,
)
from app.services.notification_service import notify_student

router = APIRouter()


# ============================================================
# UGC QUEUE
# ============================================================

@router.get("/ugc/queue")
async def get_ugc_queue(
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
    source_type: str | None = Query(None),
    auto_check_passed: bool | None = Query(None),
    sort_by: str = Query("submitted_at"),
) -> list[dict[str, Any]]:
    q = (
        supabase.table("ugc_submissions")
        .select("*")
        .in_("status", ["admin_queued", "pending_manual"])
    )
    if source_type:
        q = q.eq("source_type", source_type)
    if auto_check_passed is not None:
        q = q.eq("auto_check_passed", auto_check_passed)

    if sort_by == "source_type":
        q = q.order("source_type")
    elif sort_by == "auto_check_passed":
        q = q.order("auto_check_passed", desc=True)
    else:
        q = q.order("submitted_at")

    resp = await q.execute()
    queue = rows(resp)

    sla_cutoff = datetime.now(timezone.utc) - timedelta(minutes=VERIFICATION_SLA_EVENT_DAY)
    for entry in queue:
        try:
            submitted = datetime.fromisoformat(entry["submitted_at"].replace("Z", "+00:00"))
            if submitted.tzinfo is None:
                submitted = submitted.replace(tzinfo=timezone.utc)
        except Exception:
            submitted = datetime.now(timezone.utc)
        entry["is_stale"] = submitted < sla_cutoff
        entry["coins_if_approved"] = COIN_VALUES.get(entry["source_type"], 0)
        if entry.get("power_hour_eligible"):
            entry["coins_if_approved"] *= 2
    return queue


class UGCApproveIn(BaseModel):
    submission_id: str


@router.post("/ugc/approve")
async def approve_ugc(
    payload: UGCApproveIn,
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    sub_resp = await (
        supabase.table("ugc_submissions")
        .select("*")
        .eq("id", payload.submission_id)
        .limit(1)
        .execute()
    )
    submission = first_row(sub_resp)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission["status"] in {"verified", "rejected"}:
        raise HTTPException(
            status_code=400, detail=f"Already {submission['status']}"
        )

    base_coins = COIN_VALUES.get(submission["source_type"], 0)
    if base_coins == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No coin value configured for {submission['source_type']}",
        )

    pub_ts_str = (submission.get("metadata") or {}).get("published_timestamp")
    pub_ts = None
    if pub_ts_str:
        try:
            pub_ts = datetime.fromisoformat(str(pub_ts_str).replace("Z", "+00:00"))
        except ValueError:
            pub_ts = None

    # Power Hour multiplier — only one multiplier per student per window.
    # The submission's `power_hour_eligible` is locked at submit time, but
    # whether we *apply* the bonus also depends on whether this student
    # already received a POWER_HOUR_BONUS for the same window.
    from app.services.auto_check_service import power_hour_window_key
    window_key: str | None = None
    apply_bonus = False
    if submission.get("power_hour_eligible") and pub_ts is not None:
        window_key = power_hour_window_key(pub_ts)
        if window_key:
            existing = await (
                supabase.table("coins_ledger")
                .select("id")
                .eq("student_id", submission["student_id"])
                .eq("source_type", "POWER_HOUR_BONUS")
                .filter("metadata->>window_key", "eq", window_key)
                .limit(1)
                .execute()
            )
            apply_bonus = first_row(existing) is None

    # Insert the base credit row.
    ledger = await credit_coins(
        supabase,
        student_id=submission["student_id"],
        source_type=submission["source_type"],
        coins=base_coins,
        verified_by=admin.uid,
        reference_url=submission["url"],
        power_hour_applied=apply_bonus,
        published_timestamp=pub_ts,
        metadata={
            "submission_id": submission["id"],
            "content_fingerprint": submission.get("content_fingerprint"),
            "window_key": window_key,
        },
    )

    bonus_ledger = None
    coins_credited = base_coins
    if apply_bonus:
        bonus_ledger = await credit_coins(
            supabase,
            student_id=submission["student_id"],
            source_type="POWER_HOUR_BONUS",
            coins=base_coins,
            verified_by=admin.uid,
            reference_url=submission["url"],
            power_hour_applied=True,
            published_timestamp=pub_ts,
            metadata={
                "base_ledger_id": ledger["id"],
                "submission_id": submission["id"],
                "window_key": window_key,
            },
        )
        coins_credited += base_coins

    await (
        supabase.table("ugc_submissions")
        .update({
            "status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "verified_by": admin.uid,
        })
        .eq("id", submission["id"])
        .execute()
    )

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="APPROVE_UGC",
        entity_type="ugc_submissions",
        entity_id=submission["id"],
        after_state={
            "coins": coins_credited,
            "power_hour_applied": apply_bonus,
            "window_key": window_key,
        },
    )
    await notify_student(
        submission["student_id"],
        "ugc_approved",
        {"source": submission["source_type"], "coins": coins_credited},
    )
    return {
        "ledger_entry": ledger,
        "bonus_entry": bonus_ledger,
        "coins_credited": coins_credited,
        "power_hour_applied": apply_bonus,
    }


class UGCRejectIn(BaseModel):
    submission_id: str
    reason: str = Field(..., min_length=1)


@router.post("/ugc/reject")
async def reject_ugc(
    payload: UGCRejectIn,
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    sub_resp = await (
        supabase.table("ugc_submissions")
        .select("*")
        .eq("id", payload.submission_id)
        .limit(1)
        .execute()
    )
    submission = first_row(sub_resp)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission["status"] in {"verified", "rejected"}:
        raise HTTPException(
            status_code=400, detail=f"Already {submission['status']}"
        )

    await (
        supabase.table("ugc_submissions")
        .update({
            "status": "rejected",
            "rejection_reason": payload.reason,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "verified_by": admin.uid,
        })
        .eq("id", submission["id"])
        .execute()
    )

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="REJECT_UGC",
        entity_type="ugc_submissions",
        entity_id=submission["id"],
        reason=payload.reason,
    )
    await notify_student(
        submission["student_id"],
        "ugc_rejected",
        {"source": submission["source_type"], "reason": payload.reason},
    )
    return {"status": "rejected"}


# ============================================================
# MANUAL ADJUSTMENT  *prm_lead+
# ============================================================

class ManualAdjustIn(BaseModel):
    student_id: str
    coins: int
    reason: str = Field(..., min_length=1)


@router.post("/coins/manual-adjust")
async def manual_adjust(
    payload: ManualAdjustIn,
    admin: Admin = Depends(get_prm_lead_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    # Mandatory non-empty reason — Pydantic min_length=1 covers it, but
    # we strip + recheck to catch whitespace-only strings.
    if not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reason is mandatory for manual adjustments",
        )

    ledger = await credit_coins(
        supabase,
        student_id=payload.student_id,
        source_type="MANUAL_ADJUSTMENT",
        coins=payload.coins,
        verified_by=admin.uid,
        metadata={"reason": payload.reason},
    )
    # The ledger entry already carries `reason` via metadata — also stamp the
    # top-level `reason` column so audit and dispute reads can find it without
    # peeking into JSONB.
    await (
        supabase.table("coins_ledger")
        .update({"reason": payload.reason})
        .eq("id", ledger["id"])
        .execute()
    )

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="MANUAL_ADJUST",
        entity_type="coins_ledger",
        entity_id=ledger["id"],
        after_state={"coins": payload.coins, "student_id": payload.student_id},
        reason=payload.reason,
    )
    return ledger


# ============================================================
# LEADERBOARD (admin)
# ============================================================

@router.get("/leaderboard")
async def admin_leaderboard(
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    return await get_live_leaderboard(supabase, limit=None)


# ============================================================
# SNAPSHOT  *prm_lead+
# ============================================================

class SnapshotIn(BaseModel):
    snapshot_type: str
    force: bool = False
    force_reason: str | None = None


@router.post("/snapshot/take")
async def snapshot_take(
    payload: SnapshotIn,
    admin: Admin = Depends(get_prm_lead_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    if payload.force and not (payload.force_reason or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="force_reason required when force=True",
        )
    try:
        snapshot = await take_leaderboard_snapshot(
            supabase,
            snapshot_type=payload.snapshot_type,
            taken_by=admin.uid,
            force=payload.force,
            force_reason=payload.force_reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Trigger digital reward issuance for missed-cutoff students.
    # Implemented inline here since Step 13 owns the surprise-drop side.
    await _issue_digital_safety_net(supabase, snapshot)
    return snapshot


async def _issue_digital_safety_net(
    supabase: AsyncClient, snapshot: dict[str, Any]
) -> None:
    """Issue certificates for students who crossed the coin threshold but
    missed the rank cutoff. The `merch_eligibility` block already lists the
    eligible IDs; everyone *not* in that list but at/above the threshold
    gets a digital reward."""
    threshold = snapshot["merch_eligibility"]["threshold"]
    eligible_ids = set(snapshot["merch_eligibility"]["eligible"])
    leaderboard = snapshot["snapshot_data"]["leaderboard"]
    for entry in leaderboard:
        if entry["coins"] >= threshold and entry["student_id"] not in eligible_ids:
            await notify_student(
                entry["student_id"],
                "certificate_issued",
                {
                    "snapshot_type": snapshot["snapshot_type"],
                    "tier": snapshot["merch_eligibility"]["tier"],
                },
            )


# ============================================================
# SURPRISE DROP  *prm_lead+
# ============================================================

class SurpriseDropIn(BaseModel):
    criteria: str = Field(..., min_length=1)
    reward_tier: str
    max_winners: int = Field(..., gt=0)
    window_minutes: int = Field(..., gt=0)
    coin_reward: int | None = None


@router.post("/surprise-drop/trigger")
async def trigger_surprise_drop(
    payload: SurpriseDropIn,
    admin: Admin = Depends(get_prm_lead_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(minutes=payload.window_minutes)
    insert_resp = await supabase.table("surprise_drops").insert({
        "criteria": payload.criteria,
        "reward_tier": payload.reward_tier,
        "max_winners": payload.max_winners,
        "window_start": now.isoformat(),
        "window_end": window_end.isoformat(),
        "triggered_by": admin.uid,
        "coin_reward": payload.coin_reward,
        "status": "active",
    }).execute()
    drop = rows(insert_resp)[0]

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="DROP_TRIGGERED",
        entity_type="surprise_drops",
        entity_id=drop["id"],
        after_state={
            "criteria": payload.criteria,
            "reward_tier": payload.reward_tier,
            "max_winners": payload.max_winners,
        },
    )

    # Broadcast to every attending student.
    attendees_resp = await (
        supabase.table("users")
        .select("id")
        .eq("is_attending", True)
        .execute()
    )
    for u in rows(attendees_resp):
        await notify_student(
            u["id"],
            "surprise_drop_live",
            {"criteria": payload.criteria},
        )
    return drop


class CancelDropIn(BaseModel):
    drop_id: str


@router.post("/surprise-drop/cancel")
async def cancel_surprise_drop(
    payload: CancelDropIn,
    admin: Admin = Depends(get_prm_lead_or_above),
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
    await (
        supabase.table("surprise_drops")
        .update({"status": "cancelled"})
        .eq("id", payload.drop_id)
        .execute()
    )
    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="DROP_CANCELLED",
        entity_type="surprise_drops",
        entity_id=payload.drop_id,
    )
    return {"status": "cancelled"}


# ============================================================
# BOOTH ACTIVITY MONITOR
# ============================================================

@router.get("/booth/activity")
async def booth_activity(
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
    volunteer_id: int | None = Query(None),
    booth_id: str | None = Query(None),
    minutes: int = Query(60),
) -> dict[str, Any]:
    since = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
    q = (
        supabase.table("coins_ledger")
        .select("*")
        .gte("created_at", since)
        .order("created_at", desc=True)
    )
    if volunteer_id is not None:
        q = q.eq("verified_by", volunteer_id)
    resp = await q.execute()
    feed = rows(resp)
    if booth_id:
        feed = [r for r in feed if (r.get("metadata") or {}).get("booth_id") == booth_id]

    # Anomaly: >10 awards from same volunteer in the last 5 min
    five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    counts: dict[Any, int] = {}
    for r in feed:
        if not r.get("verified_by"):
            continue
        try:
            ts = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts >= five_min_ago:
                counts[r["verified_by"]] = counts.get(r["verified_by"], 0) + 1
        except Exception:
            continue
    anomalies = [v for v, c in counts.items() if c > 10]

    return {"feed": feed, "anomaly_volunteer_ids": anomalies}


# ============================================================
# DISPUTES
# ============================================================

@router.get("/disputes")
async def list_disputes(
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
    status_filter: str = Query("open", alias="status"),
) -> list[dict[str, Any]]:
    resp = await (
        supabase.table("dispute_tickets")
        .select("*")
        .eq("status", status_filter)
        .order("created_at", desc=True)
        .execute()
    )
    return rows(resp)


class DisputeResolveIn(BaseModel):
    ticket_id: str
    resolution_note: str = Field(..., min_length=1)
    action: str = Field(..., pattern="^(approve_reversal|reject_dispute)$")


@router.post("/disputes/resolve")
async def resolve_dispute(
    payload: DisputeResolveIn,
    admin: Admin = Depends(get_prm_lead_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    ticket_resp = await (
        supabase.table("dispute_tickets")
        .select("*")
        .eq("id", payload.ticket_id)
        .limit(1)
        .execute()
    )
    ticket = first_row(ticket_resp)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["status"] != "open":
        raise HTTPException(status_code=400, detail="Ticket already resolved")

    new_status = "resolved" if payload.action == "approve_reversal" else "rejected"

    if payload.action == "approve_reversal":
        # Insert a reversal row for the disputed entry.
        from app.services.coins_service import post_reversal
        await post_reversal(
            supabase,
            original_entry_id=ticket["ledger_entry_id"],
            student_id=ticket["student_id"],
            reason=f"dispute_resolved: {payload.resolution_note}",
        )

    await (
        supabase.table("dispute_tickets")
        .update({
            "status": new_status,
            "resolution_note": payload.resolution_note,
            "resolved_by": admin.uid,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", payload.ticket_id)
        .execute()
    )

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="DISPUTE_RESOLVED",
        entity_type="dispute_tickets",
        entity_id=payload.ticket_id,
        after_state={"action": payload.action},
        reason=payload.resolution_note,
    )
    return {"status": new_status}


# ============================================================
# INVENTORY
# ============================================================

@router.get("/inventory")
async def inventory(
    admin: Admin = Depends(get_prm_volunteer_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    resp = await supabase.table("reward_inventory").select("*").execute()
    out = []
    for row in rows(resp):
        remaining = row["total_stock"] - row["allocated"] - row["surprise_drop_reserve"]
        out.append({**row, "remaining": remaining})
    return out


# ============================================================
# ENGAGEMENT WORKBENCH  *prm_lead+ (two-person sign-off)
# ============================================================

class EngagementSubmitIn(BaseModel):
    student_id: str
    likes: int = Field(0, ge=0)
    comments: int = Field(0, ge=0)
    reposts: int = Field(0, ge=0)
    second_admin_id: int


@router.post("/engagement/submit")
async def engagement_submit(
    payload: EngagementSubmitIn,
    admin: Admin = Depends(get_prm_lead_or_above),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    # Two-person sign-off: second_admin must exist and be a different account.
    if payload.second_admin_id == admin.uid:
        raise HTTPException(
            status_code=400,
            detail="second_admin_id must be a different admin account",
        )
    second_resp = await (
        supabase.table("admins")
        .select("uid, role")
        .eq("uid", payload.second_admin_id)
        .limit(1)
        .execute()
    )
    second = first_row(second_resp)
    if second is None:
        raise HTTPException(status_code=400, detail="second_admin_id not found")
    if second["role"] not in {"prm_volunteer", "prm_lead", "ops_lead", "admin"}:
        raise HTTPException(
            status_code=400,
            detail="second_admin must be a PRM volunteer or above",
        )

    raw_coins = (
        payload.likes * ENGAGEMENT_LIKE_COINS
        + payload.comments * ENGAGEMENT_COMMENT_COINS
        + payload.reposts * ENGAGEMENT_REPOST_COINS
    )
    if raw_coins <= 0:
        raise HTTPException(status_code=400, detail="No engagement to credit")

    # Cap enforcement — sum existing ENGAGEMENT for this student.
    existing_resp = await (
        supabase.table("coins_ledger")
        .select("coins")
        .eq("student_id", payload.student_id)
        .eq("source_type", "ENGAGEMENT")
        .eq("status", "verified")
        .execute()
    )
    already = sum(r["coins"] for r in rows(existing_resp))
    remaining_capacity = max(0, ENGAGEMENT_CAP - already)
    if remaining_capacity == 0:
        raise HTTPException(status_code=400, detail="Engagement cap already reached")
    coins_to_credit = min(raw_coins, remaining_capacity)

    ledger = await credit_coins(
        supabase,
        student_id=payload.student_id,
        source_type="ENGAGEMENT",
        coins=coins_to_credit,
        verified_by=admin.uid,
        metadata={
            "second_admin_id": payload.second_admin_id,
            "likes": payload.likes,
            "comments": payload.comments,
            "reposts": payload.reposts,
            "raw_coins": raw_coins,
            "capped_at": coins_to_credit,
        },
    )
    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="ENGAGEMENT_SUBMIT",
        entity_type="coins_ledger",
        entity_id=ledger["id"],
        after_state={
            "student_id": payload.student_id,
            "coins": coins_to_credit,
            "second_admin_id": payload.second_admin_id,
        },
    )
    return {**ledger, "coins_credited": coins_to_credit}


# ============================================================
# AUDIT LOG  ops_lead / admin only
# ============================================================

@router.get("/audit-log")
async def audit_log(
    admin: Admin = Depends(get_ops_lead_or_above),
    supabase: AsyncClient = Depends(get_supabase),
    actor_id: str | None = Query(None),
    action: str | None = Query(None),
    minutes: int = Query(1440),
    limit: int = Query(500, le=2000),
) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
    q = (
        supabase.table("audit_log")
        .select("*")
        .gte("timestamp", since)
        .order("timestamp", desc=True)
        .limit(limit)
    )
    if actor_id:
        q = q.eq("actor_id", actor_id)
    if action:
        q = q.eq("action", action)
    resp = await q.execute()
    return rows(resp)
