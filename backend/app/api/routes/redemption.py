"""
Redemption Booth endpoints — used by redemption_volunteer accounts on event day.

Flow:
  1. Volunteer scans student QR (UUID).
  2. GET /redemption/student/{student_id}  → balance + tier eligibility.
  3. Volunteer gives physical reward, clicks confirm.
  4. POST /redemption/award                → deducts coins, records redemption.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.api.deps import get_current_admin
from app.core.coins_config import TIER_THRESHOLDS
from app.db.supabase_client import first_row, get_supabase, rows
from app.models.admin import Admin
from app.services.coins_service import credit_coins, write_audit

router = APIRouter()

_REDEMPTION_ROLES = {"redemption_volunteer", "ops_lead", "admin"}

TIER_LABELS = {
    "STICKER":      "Sticker",
    "BADGE":        "Badge",
    "NOTEPAD":      "Notepad",
    "MUG":          "Mug",
    "TOTE_BAG_MUG": "Tote Bag + Mug",
}


async def _get_redemption_volunteer(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    if admin.role.value not in _REDEMPTION_ROLES:
        raise HTTPException(403, "Redemption volunteer role required")
    return admin


async def _balance(supabase: AsyncClient, student_id: str) -> int:
    resp = await (
        supabase.table("coins_ledger")
        .select("coins")
        .eq("student_id", student_id)
        .eq("status", "verified")
        .execute()
    )
    return sum(r["coins"] for r in rows(resp))


async def _redeemed_tiers(supabase: AsyncClient, student_id: str) -> set[str]:
    resp = await (
        supabase.table("reward_redemptions")
        .select("tier")
        .eq("student_id", student_id)
        .in_("status", ["pending", "claimed"])
        .execute()
    )
    return {r["tier"] for r in rows(resp)}


# ── GET /redemption/student/{student_id} ─────────────────────────────────────

@router.get("/student/{student_id}")
async def get_student_for_redemption(
    student_id: str,
    admin: Admin = Depends(_get_redemption_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    resp = await (
        supabase.table("users")
        .select("id, name, username, email")
        .eq("id", student_id)
        .limit(1)
        .execute()
    )
    student = first_row(resp)
    if student is None:
        raise HTTPException(404, "Student not found")

    balance   = await _balance(supabase, student_id)
    redeemed  = await _redeemed_tiers(supabase, student_id)

    tiers = [
        {
            "key":              key,
            "label":            TIER_LABELS.get(key, key),
            "threshold":        threshold,
            "eligible":         balance >= threshold,
            "already_redeemed": key in redeemed,
        }
        for key, threshold in TIER_THRESHOLDS.items()
    ]

    return {
        "student": {
            "id":       str(student["id"]),
            "name":     student.get("name") or student.get("username", ""),
            "username": student.get("username", ""),
            "email":    student.get("email", ""),
        },
        "balance": balance,
        "tiers":   tiers,
    }


# ── POST /redemption/award ────────────────────────────────────────────────────

class AwardIn(BaseModel):
    student_id: str
    tier: str
    client_uuid: str = Field(..., min_length=8)


@router.post("/award")
async def award_redemption(
    payload: AwardIn,
    admin: Admin = Depends(_get_redemption_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    tier = payload.tier
    if tier not in TIER_THRESHOLDS:
        raise HTTPException(400, f"Unknown tier '{tier}'")

    threshold  = TIER_THRESHOLDS[tier]
    student_id = payload.student_id

    # Guard: already redeemed this tier?
    already = await (
        supabase.table("reward_redemptions")
        .select("id")
        .eq("student_id", student_id)
        .eq("tier", tier)
        .in_("status", ["pending", "claimed"])
        .limit(1)
        .execute()
    )
    if first_row(already):
        raise HTTPException(400, f"{TIER_LABELS.get(tier, tier)} already redeemed for this student")

    # Guard: sufficient balance?
    balance = await _balance(supabase, student_id)
    if balance < threshold:
        raise HTTPException(400, f"Insufficient balance ({balance} < {threshold})")

    # Record the redemption
    await (
        supabase.table("reward_redemptions")
        .insert({
            "student_id":           student_id,
            "tier":                 tier,
            "status":               "claimed",
            "claimed_at":           datetime.now(timezone.utc).isoformat(),
            "claimed_by_volunteer": admin.uid,
        })
        .execute()
    )

    # Deduct coins via a negative ledger entry
    await credit_coins(
        supabase,
        student_id=student_id,
        source_type="REDEMPTION",
        coins=-threshold,
        verified_by=admin.uid,
        metadata={"tier": tier, "volunteer_uid": admin.uid},
    )

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="redemption_awarded",
        entity_type="reward_redemptions",
        entity_id=student_id,
        detail={"tier": tier, "coins_deducted": threshold},
    )

    return {
        "success":        True,
        "tier":           tier,
        "tier_label":     TIER_LABELS.get(tier, tier),
        "coins_deducted": threshold,
        "new_balance":    balance - threshold,
    }


# ── GET /redemption/history ───────────────────────────────────────────────────

@router.get("/history")
async def redemption_history(
    admin: Admin = Depends(_get_redemption_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    resp = await (
        supabase.table("reward_redemptions")
        .select("id, student_id, tier, claimed_at, status")
        .eq("claimed_by_volunteer", admin.uid)
        .eq("status", "claimed")
        .order("claimed_at", desc=True)
        .limit(50)
        .execute()
    )
    return rows(resp)
