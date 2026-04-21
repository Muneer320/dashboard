"""
Question service — CRUD for event.questions JSONB.

Admin-only writes; user-facing reads (registration-gated).
"""

from __future__ import annotations

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.models.event import Event
from app.schemas.question import (
    EventQuestionsPayload,
    QuestionDefinition,
)
from app.services.event_service import get_event


def get_questions_for_phase(event: Event, phase: int) -> list[QuestionDefinition]:
    """
    Return the ordered question list for `phase` from event.questions.
    Raises 404 if the phase has no questions defined yet.
    """
    phase_key = f"phase{phase}"
    raw = (event.questions or {}).get(phase_key)
    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions defined for {phase_key} of event '{event.name}'",
        )
    # raw is a list[dict] from JSONB — parse into typed models
    try:
        return [QuestionDefinition.model_validate(q) for q in raw]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Malformed question data for {phase_key}: {exc}",
        ) from exc


async def set_questions_for_event(
    supabase: AsyncClient,
    event_id: str,
    payload: EventQuestionsPayload,
) -> Event:
    """
    Fully replace event.questions with the validated payload.
    Existing phase keys not present in the payload are removed.
    Validates that every referenced phase exists in event.rounds.
    """
    event = await get_event(supabase, event_id)
    rounds = event.rounds or {}

    # Every phase key in the payload must correspond to an existing round
    missing_rounds = [
        pk for pk in payload.questions if pk not in rounds
    ]
    if missing_rounds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Phase(s) {missing_rounds} do not exist in event.rounds. "
                "Create the round first before assigning questions."
            ),
        )

    # Serialise back to plain dicts for JSONB storage
    questions_dict = {
        phase_key: [q.model_dump() for q in questions]
        for phase_key, questions in payload.questions.items()
    }

    await (
        supabase.table("events")
        .update({"questions": questions_dict})
        .eq("id", str(event.id))
        .execute()
    )

    event.questions = questions_dict
    return event
