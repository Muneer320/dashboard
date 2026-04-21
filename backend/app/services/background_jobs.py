from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.db.supabase_client import get_client, rows
from app.schemas.unstop import UnstopUserItem
from app.services.rate_limit_service import cleanup_expired_rate_limits
from app.services.unstop_service import sync_unstop_users


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


async def run_background_jobs_once() -> None:
    supabase = await get_client()
    await enforce_event_phase_state()
    await sync_unstop_from_file_source()
    await cleanup_expired_rate_limits(supabase, settings.QR_RATE_LIMIT_WINDOW_SECONDS)


async def run_background_jobs_loop() -> None:
    while True:
        await run_background_jobs_once()
        await asyncio.sleep(settings.BACKGROUND_JOB_INTERVAL_SECONDS)
