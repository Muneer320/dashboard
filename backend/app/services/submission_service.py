"""Supabase-backed submission service."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.models.event import Event
from app.models.user import User
from app.schemas.submission import SubmissionLinks
from app.services.access_control import validate_event_access


async def submit_for_event(
    supabase: AsyncClient,
    user: User,
    event: Event,
    phase: int,
    repo_link: str,
    deploy_link: str,
) -> tuple[datetime, SubmissionLinks]:
    """
    Record a submission for a user in an event phase.

    Stores:
      user.events[event_id]['submission'] = { repoLink, deployLink, submittedAt }
      event.participants[user_id]['submission'][phaseN] = same shape

    Writes to two tables; without SQL transactions these are independent calls.
    We write the user row first so a failure on the event row leaves a
    recoverable "submitted-on-user, not-on-event" state that admins can inspect.
    """
    if not repo_link.strip() and not deploy_link.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of repo_link or deploy_link must be provided",
        )

    event_entry = validate_event_access(user, event, phase)
    user_events = user.events or {}
    participants = event.participants or {}

    event_key = str(event.id)
    user_key = str(user.id)
    phase_key = f"phase{phase}"
    submitted_at = datetime.now(timezone.utc)
    submitted_iso = submitted_at.isoformat()

    submission_obj = {
        "repoLink": repo_link.strip(),
        "deployLink": deploy_link.strip(),
        "submittedAt": submitted_iso,
    }

    # ── Write into user.events ─────────────────────────────────────────────────
    event_entry["submission"] = submission_obj
    user_events[event_key] = event_entry

    # ── Write into event.participants (per-phase tracking) ────────────────────
    participant_entry = participants.get(user_key, {})
    phase_submissions = participant_entry.get("submission", {})
    if not isinstance(phase_submissions, dict):
        phase_submissions = {}  # migrate old bool/null value
    phase_submissions[phase_key] = submission_obj
    participant_entry["submission"] = phase_submissions
    participants[user_key] = participant_entry

    user.events = user_events
    event.participants = participants

    # Persist: user row then event row.
    await (
        supabase.table("users")
        .update({"events": user_events})
        .eq("id", user_key)
        .execute()
    )
    await (
        supabase.table("events")
        .update({"participants": participants})
        .eq("id", event_key)
        .execute()
    )

    links = SubmissionLinks(
        repoLink=submission_obj["repoLink"],
        deployLink=submission_obj["deployLink"],
        submittedAt=submitted_at,
    )
    return submitted_at, links


def get_submission_for_phase(user: User, event: Event, phase: int) -> dict:
    participants = event.participants or {}
    participant_entry = participants.get(str(user.id), {})
    phase_key = f"phase{phase}"
    submission = (participant_entry.get("submission") or {}).get(phase_key)

    links = None
    if submission and isinstance(submission, dict):
        links = SubmissionLinks(
            repoLink=submission.get("repoLink", ""),
            deployLink=submission.get("deployLink", ""),
            submittedAt=submission.get("submittedAt"),
        )

    return {
        "event_id": str(event.id),
        "phase": phase,
        "has_submission": links is not None,
        "submission": links,
    }
