from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.event import Event
from app.schemas.unstop import UnstopUserItem
from app.services.unstop_service import sync_unstop_users


async def enforce_event_phase_state() -> None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Event))
        events = list(result.scalars().all())
        any_event_mutated = False

        for event in events:
            event_mutated = False
            rounds = event.rounds or {}
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
                    event_mutated = True
            if event_mutated:
                event.rounds = rounds
                session.add(event)
                any_event_mutated = True
        if any_event_mutated:
            await session.commit()


async def sync_unstop_from_file_source() -> None:
    if not settings.UNSTOP_SYNC_SOURCE_JSON:
        return

    source_path = Path(settings.UNSTOP_SYNC_SOURCE_JSON)
    if not source_path.exists():
        return

    payload = json.loads(source_path.read_text(encoding="utf-8"))
    users = [UnstopUserItem.model_validate(item) for item in payload]
    async with AsyncSessionLocal() as session:
        await sync_unstop_users(session, users)


async def run_background_jobs_once() -> None:
    await enforce_event_phase_state()
    await sync_unstop_from_file_source()


async def run_background_jobs_loop() -> None:
    while True:
        await run_background_jobs_once()
        await asyncio.sleep(settings.BACKGROUND_JOB_INTERVAL_SECONDS)
