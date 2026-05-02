"""
UGC (User-Generated Content) submission endpoints.

A student submits a public LinkedIn / Instagram URL for a particular
source_type. Auto-check runs synchronously, the row lands in
ugc_submissions for admin review, and a Creator Collab also creates a
pending invite for the second participant.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.core.coins_config import (
    COIN_VALUES,
    CREATOR_COLLAB_CONFIRM_HOURS,
    MVP_JOBS_SHARED_CAP,
    PER_STUDENT_CAPPED_SOURCES,
    UGC_URL_SOURCES,
)
from app.db.supabase_client import first_row, get_supabase, rows
from app.models.user import User
from app.services.auto_check_service import run_auto_check
from app.services.coins_service import write_audit

router = APIRouter()


# ----------------------------- helpers -----------------------------

async def _ledger_count(
    supabase: AsyncClient, student_id: str, source_type: str
) -> int:
    resp = await (
        supabase.table("coins_ledger")
        .select("id, coins")
        .eq("student_id", student_id)
        .eq("source_type", source_type)
        .eq("status", "verified")
        .execute()
    )
    return len(rows(resp))


async def _ledger_sum_coins(
    supabase: AsyncClient, student_id: str, source_types: list[str]
) -> int:
    resp = await (
        supabase.table("coins_ledger")
        .select("coins")
        .eq("student_id", student_id)
        .in_("source_type", source_types)
        .eq("status", "verified")
        .execute()
    )
    return sum(r["coins"] for r in rows(resp))


async def _has_pending_submission(
    supabase: AsyncClient, student_id: str, source_type: str
) -> bool:
    resp = await (
        supabase.table("ugc_submissions")
        .select("id")
        .eq("student_id", student_id)
        .eq("source_type", source_type)
        .in_("status", ["submitted", "auto_checked", "admin_queued", "pending_manual"])
        .limit(1)
        .execute()
    )
    return first_row(resp) is not None


async def _has_round_registration(supabase: AsyncClient, user: User) -> bool:
    """ROUND1_PROJECT requires registration in at least one event with rounds."""
    if not user.events:
        return False
    return any(
        isinstance(v, dict) and v.get("status") in {"registered", "qualified"}
        for v in user.events.values()
    )


# ----------------------------- eligibility -----------------------------

@router.get("/eligibility")
async def get_eligibility(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, bool | str]:
    student_id = str(user.id)
    rsvp_count = await _ledger_count(supabase, student_id, "RSVP_POST")
    round1_count = await _ledger_count(supabase, student_id, "ROUND1_PROJECT")
    fv_count = await _ledger_count(supabase, student_id, "FUTURE_VISION")
    cc_count = await _ledger_count(supabase, student_id, "CREATOR_COLLAB")
    mvp_jobs_total = await _ledger_sum_coins(
        supabase, student_id, ["MVP_MUSEUM", "JOBS_WALL"]
    )
    has_round = await _has_round_registration(supabase, user)

    return {
        "rsvp":            rsvp_count == 0,
        "round1_project":  round1_count == 0 and has_round,
        "future_vision":   fv_count == 0,
        "mvp_museum":      mvp_jobs_total < MVP_JOBS_SHARED_CAP,
        "jobs_wall":       mvp_jobs_total < MVP_JOBS_SHARED_CAP,
        "creator_collab":  cc_count == 0,
    }


# ----------------------------- submit -----------------------------

class UGCSubmitIn(BaseModel):
    source_type: str = Field(..., description="One of UGC_URL_SOURCES")
    url: str = Field(..., min_length=8)
    participant_2_id: str | None = Field(
        None, description="Required only for CREATOR_COLLAB"
    )


@router.post("/submit")
async def submit_ugc(
    payload: UGCSubmitIn,
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    src = payload.source_type
    if src not in UGC_URL_SOURCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"source_type must be one of {UGC_URL_SOURCES}",
        )

    student_id = str(user.id)

    # 1. Per-student caps
    if src in PER_STUDENT_CAPPED_SOURCES:
        existing = await _ledger_count(supabase, student_id, src)
        if existing > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{src} already credited for this student",
            )

    # 2. MVP + Jobs Wall shared cap
    if src in {"MVP_MUSEUM", "JOBS_WALL"}:
        combined = await _ledger_sum_coins(
            supabase, student_id, ["MVP_MUSEUM", "JOBS_WALL"]
        )
        if combined >= MVP_JOBS_SHARED_CAP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MVP_MUSEUM + JOBS_WALL shared cap reached",
            )

    # 3. ROUND1_PROJECT requires a registered event
    if src == "ROUND1_PROJECT" and not await _has_round_registration(supabase, user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Register for a build event first",
        )

    # 4. CREATOR_COLLAB needs a second participant
    if src == "CREATOR_COLLAB":
        if not payload.participant_2_id or payload.participant_2_id == student_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="participant_2_id required and must be a different student",
            )
        p2_resp = await (
            supabase.table("users")
            .select("id")
            .eq("id", payload.participant_2_id)
            .limit(1)
            .execute()
        )
        if first_row(p2_resp) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="participant_2_id does not exist",
            )

    # 5. Block re-submit while one is already pending
    if await _has_pending_submission(supabase, student_id, src):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A {src} submission is already in review",
        )

    # 5b. Pre-check the (url, source_type) unique constraint so we surface a
    # 400 instead of a generic 500. This catches the case where a previous
    # submission of the same URL (often by a different student) already
    # exists — including ones that were already rejected.
    existing_url = await (
        supabase.table("ugc_submissions")
        .select("id, student_id, status")
        .eq("url", payload.url)
        .eq("source_type", src)
        .limit(1)
        .execute()
    )
    existing_url_row = first_row(existing_url)
    if existing_url_row is not None:
        same_user = existing_url_row["student_id"] == student_id
        if same_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "You've already submitted this exact URL for "
                    f"{src} (status: {existing_url_row['status']}). "
                    "Pick a different URL."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This URL has already been submitted by another student.",
        )

    # 6. Run auto-check
    existing_resp = await (
        supabase.table("ugc_submissions")
        .select("url, source_type, student_id")
        .eq("source_type", src)
        .execute()
    )
    auto_result = await run_auto_check(
        url=payload.url,
        source_type=src,
        student_linkedin_handle=(user.details or {}).get("linkedinHandle"),
        student_instagram_handle=(user.details or {}).get("instagramHandle"),
        submitted_at=datetime.now(timezone.utc),
        existing_submissions=rows(existing_resp),
        current_student_id=student_id,
    )

    # 7. Decide submission status
    if not auto_result["passed"]:
        sub_status = "rejected"
    elif auto_result["needs_manual_check"]:
        sub_status = "pending_manual"
    else:
        sub_status = "admin_queued"

    metadata: dict[str, Any] = {
        "auto_check_flags": auto_result["flags"],
        "content_fingerprint": auto_result["fingerprint"],
    }
    if auto_result.get("published_timestamp"):
        metadata["published_timestamp"] = (
            auto_result["published_timestamp"].isoformat()
            if isinstance(auto_result["published_timestamp"], datetime)
            else str(auto_result["published_timestamp"])
        )

    insert_resp = await supabase.table("ugc_submissions").insert({
        "student_id": student_id,
        "source_type": src,
        "url": payload.url,
        "status": sub_status,
        "auto_check_passed": auto_result["passed"],
        "auto_check_reason": auto_result["reason"],
        "power_hour_eligible": auto_result["power_hour_eligible"],
        "content_fingerprint": auto_result["fingerprint"],
        "metadata": metadata,
    }).execute()
    submission = rows(insert_resp)[0]

    # 8. Creator Collab — create pending invite for participant_2
    if src == "CREATOR_COLLAB":
        deadline = (
            datetime.now(timezone.utc) + timedelta(hours=CREATOR_COLLAB_CONFIRM_HOURS)
        ).isoformat()
        await supabase.table("creator_collab_pending").insert({
            "participant_1": student_id,
            "participant_2": payload.participant_2_id,
            "content_url": payload.url,
            "submission_id": submission["id"],
            "status": "pending",
            "deadline": deadline,
        }).execute()

    return {
        "status": sub_status,
        "auto_check_result": {
            "passed": auto_result["passed"],
            "reason": auto_result["reason"],
            "needs_manual_check": auto_result["needs_manual_check"],
            "flags": auto_result["flags"],
            "power_hour_eligible": auto_result["power_hour_eligible"],
            "coins_if_approved": COIN_VALUES.get(src, 0),
        },
        "submission_id": submission["id"],
    }


# ----------------------------- creator collab -----------------------------

class CollabConfirmIn(BaseModel):
    collab_id: str


@router.post("/creator-collab/confirm")
async def confirm_creator_collab(
    payload: CollabConfirmIn,
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    resp = await (
        supabase.table("creator_collab_pending")
        .select("*")
        .eq("id", payload.collab_id)
        .limit(1)
        .execute()
    )
    collab = first_row(resp)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collab invite not found")
    if collab["participant_2"] != str(user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the invited participant",
        )
    if collab["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Collab is already {collab['status']}",
        )
    # Deadline check
    deadline = datetime.fromisoformat(collab["deadline"].replace("Z", "+00:00"))
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > deadline:
        await (
            supabase.table("creator_collab_pending")
            .update({"status": "expired"})
            .eq("id", payload.collab_id)
            .execute()
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Collab confirmation window has expired",
        )

    await (
        supabase.table("creator_collab_pending")
        .update({"status": "confirmed"})
        .eq("id", payload.collab_id)
        .execute()
    )
    # Move both participants to admin queue if the original submission isn't already there
    if collab.get("submission_id"):
        await (
            supabase.table("ugc_submissions")
            .update({"status": "admin_queued"})
            .eq("id", collab["submission_id"])
            .execute()
        )

    return {"status": "confirmed", "collab_id": payload.collab_id}


@router.get("/pending-confirmations")
async def pending_confirmations(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict[str, Any]]:
    resp = await (
        supabase.table("creator_collab_pending")
        .select("*")
        .eq("participant_2", str(user.id))
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return rows(resp)
