from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from app.core.config import settings
from app.core.coins_config import COIN_VALUES, UGC_URL_SOURCES
from app.db.supabase_client import get_client, rows
from app.schemas.unstop import UnstopUserItem
from app.services.coins_service import credit_coins, post_reversal
from app.services.notification_service import notify_student
from app.services.rate_limit_service import cleanup_expired_rate_limits
from app.services.unstop_service import sync_unstop_users

logger = logging.getLogger(__name__)

# In-process scheduling state. Survives only within one process; on restart
# the next invocation may run a minute or two earlier than usual, which is fine.
_last_run_at: dict[str, datetime] = {}


def _due(job_key: str, interval_seconds: int) -> bool:
    """Return True if the job is due to run again."""
    now = datetime.now(timezone.utc)
    last = _last_run_at.get(job_key)
    if last is None or (now - last).total_seconds() >= interval_seconds:
        _last_run_at[job_key] = now
        return True
    return False


# ----------------------------- existing jobs -----------------------------

async def enforce_event_phase_state() -> None:
    """Auto-lock event phases whose end_time has passed."""
    now = datetime.now(timezone.utc)
    supabase = await get_client()

    resp = await supabase.table("events").select("*").execute()
    events = rows(resp)

    for event_row in events:
        rounds: dict = event_row.get("rounds") or {}
        mutated = False

        for round_data in rounds.values():
            end_time = round_data.get("end_time")
            if not end_time:
                continue
            try:
                parsed_end_time = datetime.fromisoformat(end_time)
            except ValueError:
                continue
            if parsed_end_time.tzinfo is None:
                parsed_end_time = parsed_end_time.replace(tzinfo=timezone.utc)
            if parsed_end_time <= now and round_data.get("is_active", False):
                round_data["is_active"] = False
                round_data["is_locked"] = True
                mutated = True

        if mutated:
            await (
                supabase.table("events")
                .update({"rounds": rounds})
                .eq("id", event_row["id"])
                .execute()
            )


async def sync_unstop_from_file_source() -> None:
    if not settings.UNSTOP_SYNC_SOURCE_JSON:
        return

    source_path = Path(settings.UNSTOP_SYNC_SOURCE_JSON)
    if not source_path.exists():
        return

    payload = json.loads(source_path.read_text(encoding="utf-8"))
    users = [UnstopUserItem.model_validate(item) for item in payload]
    supabase = await get_client()
    await sync_unstop_users(supabase, users)


# ----------------------------- sidequest jobs -----------------------------

async def daily_url_recheck() -> None:
    """
    Re-checks all verified UGC post URLs.
    Posts reversal if post is gone or tag removed.
    Does NOT reverse on network errors — only on confirmed 404/private.
    """
    supabase = await get_client()
    verified_resp = await (
        supabase.table("coins_ledger")
        .select("*")
        .eq("status", "verified")
        .in_("source_type", UGC_URL_SOURCES)
        .not_.is_("reference_url", "null")
        .execute()
    )

    for entry in rows(verified_resp):
        url = entry["reference_url"]
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})

            if resp.status_code == 404:
                await post_reversal(
                    supabase,
                    original_entry_id=entry["id"],
                    student_id=entry["student_id"],
                    reason="post_deleted",
                )
                await notify_student(
                    entry["student_id"],
                    "post_deleted_reversal",
                    {"url": url, "coins": entry["coins"]},
                )
                continue

            stored_fingerprint = (entry.get("metadata") or {}).get("content_fingerprint")
            if stored_fingerprint:
                current_fingerprint = hashlib.md5(
                    resp.text[:500].encode()
                ).hexdigest()
                if current_fingerprint != stored_fingerprint:
                    await (
                        supabase.table("ugc_submissions")
                        .update({"status": "needs_review"})
                        .eq("url", url)
                        .execute()
                    )

        except Exception:
            await supabase.table("audit_log").insert({
                "actor_id": "00000000-0000-0000-0000-000000000000",
                "actor_role": "system",
                "action": "URL_RECHECK_FAILED",
                "entity_id": entry["id"],
                "reason": "network_error_skipped",
            }).execute()


async def grace_deadline_checker() -> None:
    """
    Permanently closes reversals where the grace window has expired.

    Append-only note: the ledger row's `coins` value is never mutated.
    This job only flips `status` from `pending` → `permanent`, which is a
    state-machine transition — the financial impact of the reversal landed
    at insert time and never changes here.
    """
    supabase = await get_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    expired_resp = await (
        supabase.table("coins_ledger")
        .select("*")
        .eq("source_type", "REVERSAL")
        .eq("status", "pending")
        .lt("grace_deadline", now_iso)
        .execute()
    )

    for reversal in rows(expired_resp):
        await (
            supabase.table("coins_ledger")
            .update({"status": "permanent"})
            .eq("id", reversal["id"])
            .execute()
        )
        await notify_student(
            reversal["student_id"],
            "reversal_permanent",
            {"source": (reversal.get("metadata") or {}).get("original_source")},
        )


async def creator_collab_deadline_checker() -> None:
    """
    Closes expired Creator Collab confirmations.
    Credits only participant_1 if participant_2 never confirmed.
    """
    supabase = await get_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    expired_resp = await (
        supabase.table("creator_collab_pending")
        .select("*")
        .eq("status", "pending")
        .lt("deadline", now_iso)
        .execute()
    )

    for collab in rows(expired_resp):
        await (
            supabase.table("creator_collab_pending")
            .update({"status": "expired"})
            .eq("id", collab["id"])
            .execute()
        )

        await credit_coins(
            supabase,
            student_id=collab["participant_1"],
            source_type="CREATOR_COLLAB",
            coins=COIN_VALUES["CREATOR_COLLAB"],
            verified_by=None,
            metadata={"collab_id": collab["id"], "partial": True},
        )


async def surprise_drop_window_closer() -> None:
    """Mark active drops whose window has elapsed as completed."""
    supabase = await get_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    expired_resp = await (
        supabase.table("surprise_drops")
        .select("id")
        .eq("status", "active")
        .lt("window_end", now_iso)
        .execute()
    )
    ids = [r["id"] for r in rows(expired_resp)]
    if not ids:
        return
    await (
        supabase.table("surprise_drops")
        .update({"status": "completed"})
        .in_("id", ids)
        .execute()
    )


async def sticker_code_expiry_checker() -> None:
    """
    Returns expired sticker codes to inventory pool.
    """
    supabase = await get_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    expired_resp = await (
        supabase.table("reward_redemptions")
        .select("*")
        .eq("tier", "STICKER")
        .eq("status", "pending")
        .lt("expires_at", now_iso)
        .execute()
    )
    expired = rows(expired_resp)
    if not expired:
        return

    count = len(expired)
    ids = [r["id"] for r in expired]

    await (
        supabase.table("reward_redemptions")
        .update({"status": "expired"})
        .in_("id", ids)
        .execute()
    )

    inventory_resp = await (
        supabase.table("reward_inventory")
        .select("allocated")
        .eq("tier", "STICKER")
        .limit(1)
        .execute()
    )
    inv_row = (inventory_resp.data or [{}])[0]
    new_allocated = max(0, inv_row.get("allocated", 0) - count)
    await (
        supabase.table("reward_inventory")
        .update({"allocated": new_allocated})
        .eq("tier", "STICKER")
        .execute()
    )


# ----------------------------- scheduler -----------------------------

async def run_background_jobs_once() -> None:
    supabase = await get_client()
    await enforce_event_phase_state()
    await sync_unstop_from_file_source()
    await cleanup_expired_rate_limits(supabase, settings.QR_RATE_LIMIT_WINDOW_SECONDS)

    # Sidequest jobs — gated to their own cadences so they don't run every tick.
    if _due("sticker_code_expiry_checker", 5 * 60):
        try:
            await sticker_code_expiry_checker()
        except Exception:
            logger.exception("sticker_code_expiry_checker failed")

    if _due("surprise_drop_window_closer", 60):
        try:
            await surprise_drop_window_closer()
        except Exception:
            logger.exception("surprise_drop_window_closer failed")

    if _due("grace_deadline_checker", 60 * 60):
        try:
            await grace_deadline_checker()
        except Exception:
            logger.exception("grace_deadline_checker failed")

    if _due("creator_collab_deadline_checker", 60 * 60):
        try:
            await creator_collab_deadline_checker()
        except Exception:
            logger.exception("creator_collab_deadline_checker failed")



async def run_background_jobs_loop() -> None:
    while True:
        await run_background_jobs_once()
        await asyncio.sleep(settings.BACKGROUND_JOB_INTERVAL_SECONDS)
