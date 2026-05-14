"""
UGC (User-Generated Content) submission endpoints.

A student submits a public LinkedIn / Instagram URL for a particular
source_type. Auto-check runs synchronously, the row lands in
ugc_submissions for admin review, and a Creator Collab also creates a
pending invite for the second participant.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import uuid as _uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.core.coins_config import (
    COIN_VALUES,
    PER_STUDENT_CAPPED_SOURCES,
    UGC_URL_SOURCES,
    UGC_SCREENSHOT_SOURCES,
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


async def _verified_submission_count(
    supabase: AsyncClient, student_id: str, source_type: str
) -> int:
    """Count submissions for this student+source currently in 'verified' state.
    Used for cap enforcement so that an admin re-verification rejection
    (which flips status back to 'rejected') frees up the slot."""
    resp = await (
        supabase.table("ugc_submissions")
        .select("id")
        .eq("student_id", student_id)
        .eq("source_type", source_type)
        .eq("status", "verified")
        .execute()
    )
    return len(rows(resp))


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


# ----------------------------- eligibility -----------------------------

@router.get("/eligibility")
async def get_eligibility(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    student_id = str(user.id)
    all_sources = UGC_URL_SOURCES + UGC_SCREENSHOT_SOURCES

    counts = {}
    for src in all_sources:
        counts[src] = await _verified_submission_count(supabase, student_id, src)

    subs_resp = await (
        supabase.table("ugc_submissions")
        .select("source_type, status, url, rejection_reason, submitted_at, verified_at")
        .eq("student_id", student_id)
        .order("submitted_at", desc=True)
        .execute()
    )
    latest: dict[str, dict[str, Any]] = {}
    rejection_counts: dict[str, int] = {}
    for row in rows(subs_resp):
        src = row["source_type"]
        if src not in latest:
            latest[src] = {
                "status": row["status"],
                "url": row.get("url"),
                "rejection_reason": row.get("rejection_reason"),
                "submitted_at": row.get("submitted_at"),
                "verified_at": row.get("verified_at"),
            }
        if row["status"] == "rejected":
            rejection_counts[src] = rejection_counts.get(src, 0) + 1

    ineligible = {src for src in all_sources if rejection_counts.get(src, 0) >= 3}
    eligibility = {
        src.lower(): counts[src] == 0 and src not in ineligible
        for src in all_sources
    }
    eligibility["latest_submissions"] = latest
    eligibility["ineligible_sources"] = [src.lower() for src in ineligible]
    return eligibility


# ----------------------------- submit -----------------------------

_ALLOWED_SCREENSHOT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/upload-proof")
async def upload_proof_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Accept an image screenshot, store in AWS S3, return its public URL.
    Bucket name comes from the AWS_S3_UGC_BUCKET env var."""
    from app.services.s3_service import upload_ugc_proof

    if file.content_type not in _ALLOWED_SCREENSHOT_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, or WebP images accepted")
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(400, "File too large (max 10 MB)")
    ext = file.content_type.split("/")[1]
    key = f"{user.id}/{_uuid.uuid4()}.{ext}"

    try:
        public_url = await upload_ugc_proof(
            key=key, body=file_bytes, content_type=file.content_type,
        )
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc

    return {"url": public_url}


class UGCSubmitIn(BaseModel):
    source_type: str = Field(..., description="One of UGC_URL_SOURCES or UGC_SCREENSHOT_SOURCES")
    url: str = Field(..., min_length=8)
    proof_type: str = Field("url", description="'url' for link submissions, 'screenshot' for uploads")


@router.post("/submit")
async def submit_ugc(
    payload: UGCSubmitIn,
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    src = payload.source_type
    all_student_sources = UGC_URL_SOURCES + UGC_SCREENSHOT_SOURCES
    if src not in all_student_sources:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"source_type must be one of {all_student_sources}",
        )
    is_screenshot = src in UGC_SCREENSHOT_SOURCES

    student_id = str(user.id)

    # 1. Per-student caps — counted from currently-verified submissions so
    # that a re-verification rejection (which sets status back to rejected)
    # frees up the slot for re-submission.
    if src in PER_STUDENT_CAPPED_SOURCES:
        existing = await _verified_submission_count(supabase, student_id, src)
        if existing > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{src} already credited for this student",
            )

    # 2a. Block permanently ineligible sources (>= 3 rejections)
    rejected_resp = await (
        supabase.table("ugc_submissions")
        .select("id")
        .eq("student_id", student_id)
        .eq("source_type", src)
        .eq("status", "rejected")
        .execute()
    )
    if len(rows(rejected_resp)) >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum submission attempts (3) reached for {src}. This source is now ineligible.",
        )

    # 2b. Block re-submit while one is already pending
    if await _has_pending_submission(supabase, student_id, src):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A {src} submission is already in review",
        )

    # 5b. Pre-check the (url, source_type) unique constraint so we surface a
    # 400 instead of a generic 500. Same-user re-submission of an exact URL
    # is allowed when the prior row was rejected or flagged for re-verification
    # — we reuse that row instead of inserting a duplicate.
    existing_url = await (
        supabase.table("ugc_submissions")
        .select("id, student_id, status")
        .eq("url", payload.url)
        .eq("source_type", src)
        .limit(1)
        .execute()
    )
    existing_url_row = first_row(existing_url)
    reusable_row_id: str | None = None
    if existing_url_row is not None:
        same_user = existing_url_row["student_id"] == student_id
        prior_status = existing_url_row["status"]
        if same_user and prior_status in {"rejected", "needs_review"}:
            reusable_row_id = existing_url_row["id"]
        elif same_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "You've already submitted this exact URL for "
                    f"{src} (status: {prior_status}). Pick a different URL."
                ),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This URL has already been submitted by another student.",
            )

    # 6. Auto-check — skipped for screenshot sources (admin reviews the image)
    if is_screenshot:
        auto_result = {
            "passed": None,
            "reason": "screenshot_submission",
            "needs_manual_check": True,
            "flags": [],
            "fingerprint": payload.url,
            "power_hour_eligible": False,
            "published_timestamp": None,
        }
        sub_status = "admin_queued"
    else:
        existing_resp = await (
            supabase.table("ugc_submissions")
            .select("id, url, source_type, student_id")
            .eq("source_type", src)
            .execute()
        )
        existing_submissions = [
            r for r in rows(existing_resp) if r.get("id") != reusable_row_id
        ]
        auto_result = await run_auto_check(
            url=payload.url,
            source_type=src,
            student_linkedin_handle=(user.details or {}).get("linkedinHandle"),
            student_instagram_handle=(user.details or {}).get("instagramHandle"),
            submitted_at=datetime.now(timezone.utc),
            existing_submissions=existing_submissions,
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
        "proof_type": payload.proof_type,
    }
    if auto_result.get("published_timestamp"):
        metadata["published_timestamp"] = (
            auto_result["published_timestamp"].isoformat()
            if isinstance(auto_result["published_timestamp"], datetime)
            else str(auto_result["published_timestamp"])
        )

    submission_payload = {
        "student_id": student_id,
        "source_type": src,
        "url": payload.url,
        "proof_type": payload.proof_type,
        "status": sub_status,
        "auto_check_passed": auto_result["passed"],
        "auto_check_reason": auto_result["reason"],
        "power_hour_eligible": auto_result["power_hour_eligible"],
        "content_fingerprint": auto_result["fingerprint"],
        "metadata": metadata,
    }
    if reusable_row_id is not None:
        # Re-submission of the same URL: refresh the existing row so the
        # admin queue / per-source state machine sees a clean record. Clears
        # the prior rejection_reason and bumps submitted_at to "now".
        update_resp = await (
            supabase.table("ugc_submissions")
            .update({
                **submission_payload,
                "rejection_reason": None,
                "verified_at": None,
                "verified_by": None,
                "submitted_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", reusable_row_id)
            .execute()
        )
        submission = rows(update_resp)[0]
    else:
        insert_resp = await supabase.table("ugc_submissions").insert(submission_payload).execute()
        submission = rows(insert_resp)[0]

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
