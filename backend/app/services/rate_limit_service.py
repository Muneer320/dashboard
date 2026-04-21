"""Supabase-backed rate-limit service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from supabase import AsyncClient

from app.db.supabase_client import first_row, rows
from app.models._util import coerce_datetime


async def allow_rate_limited_action(
    supabase: AsyncClient,
    rate_key: str,
    limit: int,
    window_seconds: int,
) -> bool:
    now = datetime.now(timezone.utc)
    window = timedelta(seconds=window_seconds)

    resp = await (
        supabase.table("rate_limit_entries")
        .select("*")
        .eq("rate_key", rate_key)
        .limit(1)
        .execute()
    )
    row = first_row(resp)

    if row is None:
        payload = {
            "id": str(uuid.uuid4()),
            "rate_key": rate_key,
            "request_count": 1,
            "window_started_at": now.isoformat(),
        }
        await supabase.table("rate_limit_entries").insert(payload).execute()
        return True

    started_at = coerce_datetime(row.get("window_started_at"))
    if started_at is None or now - started_at >= window:
        await (
            supabase.table("rate_limit_entries")
            .update({
                "request_count": 1,
                "window_started_at": now.isoformat(),
            })
            .eq("id", row["id"])
            .execute()
        )
        return True

    current = int(row.get("request_count") or 0)
    if current >= limit:
        return False

    await (
        supabase.table("rate_limit_entries")
        .update({"request_count": current + 1})
        .eq("id", row["id"])
        .execute()
    )
    return True


async def cleanup_expired_rate_limits(
    supabase: AsyncClient, window_seconds: int
) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    resp = await (
        supabase.table("rate_limit_entries")
        .delete()
        .lt("window_started_at", cutoff.isoformat())
        .execute()
    )
    # PostgREST returns the deleted rows; count them.
    return len(rows(resp))
