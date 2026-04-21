"""
Feedback service — writes anonymous overall feedback to the `feedback` table.

The caller must be authenticated (see the route layer) but we intentionally
do NOT persist user_id — this channel is advertised as anonymous.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import Feedback


async def create_feedback(
    session: AsyncSession,
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

    row = Feedback(
        scores=scores,
        fix=_clean(fix),
        highlight=_clean(highlight),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return {"id": str(row.id)}
