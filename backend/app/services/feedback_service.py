"""
Feedback service — writes anonymous overall feedback to the `feedback` table.

The caller must be authenticated (see the route layer) but we intentionally
do NOT persist user_id — this channel is advertised as anonymous.
"""

from __future__ import annotations

import uuid

from supabase import AsyncClient

from app.db.supabase_client import first_row


async def create_feedback(
    supabase: AsyncClient,
    scores: dict,
    fix: str | None,
    highlight: str | None,
) -> dict:
    """Persist a feedback row. Returns {id}."""
    def _clean(s: str | None) -> str | None:
        if s is None:
            return None
        stripped = s.strip()
        return stripped or None

    new_id = str(uuid.uuid4())
    payload = {
        "id": new_id,
        "scores": scores,
        "fix": _clean(fix),
        "highlight": _clean(highlight),
    }
    resp = await (
        supabase.table("feedback")
        .insert(payload)
        .execute()
    )
    row = first_row(resp) or payload
    return {"id": str(row["id"])}
