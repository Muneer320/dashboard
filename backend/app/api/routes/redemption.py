"""
Redemption Booth endpoints — used by redemption_volunteer accounts on event day.

New flow (cart-based):
  1. Student locks cart in the app → pending reward_redemptions rows created,
     coins already deducted at that point.
  2. Student shows their QR (UUID) at the booth.
  3. GET /redemption/student/{student_id}  → student info + pending cart items.
  4. Volunteer hands over each physical item and clicks confirm.
  5. POST /redemption/award  → marks the specific reservation row as claimed.
     No coin deduction here — already handled by the student at cart-lock time.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import AsyncClient

from app.api.deps import get_current_admin
from app.core.coins_config import TIER_LABELS
from app.db.supabase_client import first_row, get_supabase, rows
from app.models.admin import Admin
from app.services.coins_service import write_audit

router = APIRouter()

_REDEMPTION_ROLES = {"redemption_volunteer", "ops_lead", "admin"}


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


# ── GET /redemption/student/{student_id} ─────────────────────────────────────

@router.get("/student/{student_id}")
async def get_student_for_redemption(
    student_id: str,
    admin: Admin = Depends(_get_redemption_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    resp = await (
        supabase.table("users")
        .select("id, name, username")
        .eq("id", student_id)
        .limit(1)
        .execute()
    )
    student = first_row(resp)
    if student is None:
        raise HTTPException(404, "Student not found")

    balance = await _balance(supabase, student_id)

    # Fetch only pending cart reservations — these are what the volunteer hands out
    cart_resp = await (
        supabase.table("reward_redemptions")
        .select("id, tier, status")
        .eq("student_id", student_id)
        .eq("status", "pending")
        .execute()
    )
    cart = [
        {
            "reservation_id": r["id"],
            "tier":            r["tier"],
            "label":           TIER_LABELS.get(r["tier"], r["tier"]),
        }
        for r in rows(cart_resp)
    ]

    # Also fetch already-claimed items so volunteer can see what was given
    claimed_resp = await (
        supabase.table("reward_redemptions")
        .select("id, tier, claimed_at")
        .eq("student_id", student_id)
        .eq("status", "claimed")
        .execute()
    )
    claimed = [
        {
            "tier":       r["tier"],
            "label":      TIER_LABELS.get(r["tier"], r["tier"]),
            "claimed_at": r.get("claimed_at"),
        }
        for r in rows(claimed_resp)
    ]

    return {
        "student": {
            "id":       str(student["id"]),
            "name":     student.get("name") or student.get("username", ""),
            "username": student.get("username", ""),
        },
        "balance": balance,
        "cart":    cart,
        "claimed": claimed,
    }


# ── POST /redemption/award ────────────────────────────────────────────────────

class AwardIn(BaseModel):
    reservation_id: str


@router.post("/award")
async def award_redemption(
    payload: AwardIn,
    admin: Admin = Depends(_get_redemption_volunteer),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    # Fetch the specific pending reservation
    res_resp = await (
        supabase.table("reward_redemptions")
        .select("id, student_id, tier, status")
        .eq("id", payload.reservation_id)
        .limit(1)
        .execute()
    )
    reservation = first_row(res_resp)

    if reservation is None:
        raise HTTPException(404, "Reservation not found")
    if reservation["status"] == "claimed":
        raise HTTPException(400, f"{TIER_LABELS.get(reservation['tier'], reservation['tier'])} already handed out to this student")
    if reservation["status"] != "pending":
        raise HTTPException(400, f"Reservation is in status '{reservation['status']}' — cannot award")

    tier = reservation["tier"]

    # Mark as claimed
    await (
        supabase.table("reward_redemptions")
        .update({
            "status":               "claimed",
            "claimed_at":           datetime.now(timezone.utc).isoformat(),
            "claimed_by_volunteer": admin.uid,
        })
        .eq("id", payload.reservation_id)
        .execute()
    )

    await write_audit(
        supabase,
        actor_id=admin.uid,
        actor_role=admin.role.value,
        action="redemption_awarded",
        entity_type="reward_redemptions",
        entity_id=payload.reservation_id,
        after_state={"tier": tier, "student_id": reservation["student_id"]},
    )

    return {
        "success":   True,
        "tier":      tier,
        "tier_label": TIER_LABELS.get(tier, tier),
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
