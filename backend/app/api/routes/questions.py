"""
Question routes.

User-facing
-----------
GET /events/{event_id}/questions?phase=1
    Returns the question list for a phase. Requires a valid user JWT and
    that the user is registered for the event.

Admin-facing
------------
PUT /events/{event_id}/questions
    Fully replaces the question definitions for one or more phases.
    Requires admin or eventManager JWT.
    EventManagers may only manage events assigned to them.
"""

from fastapi import APIRouter, Depends
from supabase import AsyncClient

from app.api.deps import get_admin_or_em, get_current_user
from app.db.supabase_client import get_supabase
from app.models.admin import Admin, AdminRole
from app.models.user import User
from app.schemas.question import (
    EventQuestionsPayload,
    EventQuestionsResponse,
    PhaseQuestionsResponse,
)
from app.services.event_service import get_event
from app.services.question_service import get_questions_for_phase, set_questions_for_event
from fastapi import HTTPException, status

router = APIRouter()


# ---------------------------------------------------------------------------
# User-facing: fetch questions for a phase
# ---------------------------------------------------------------------------

@router.get("/{event_id}/questions", response_model=PhaseQuestionsResponse)
async def fetch_phase_questions(
    event_id: str,
    phase: int,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> PhaseQuestionsResponse:
    """
    Return the question list for a specific event phase.

    The user must be registered for the event (checked via users.events).
    The phase must have questions defined (404 otherwise).
    """
    event = await get_event(supabase, event_id)

    # Verify the user is registered for this event
    if str(event.id) not in (current_user.events or {}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not registered for this event.",
        )

    questions = get_questions_for_phase(event, phase)
    phase_key = f"phase{phase}"
    return PhaseQuestionsResponse(
        event_id=str(event.id),
        phase=phase,
        phase_key=phase_key,
        questions=questions,
    )


# ---------------------------------------------------------------------------
# Admin-facing: set questions for an event (all phases at once)
# ---------------------------------------------------------------------------

@router.put("/{event_id}/questions", response_model=EventQuestionsResponse)
async def set_event_questions(
    event_id: str,
    payload: EventQuestionsPayload,
    supabase: AsyncClient = Depends(get_supabase),
    admin: Admin = Depends(get_admin_or_em),
) -> EventQuestionsResponse:
    """
    Fully replace the question definitions for one or more phases of an event.

    - Provide a `questions` object keyed by phase ('phase1', 'phase2', ...).
    - Each value is an ordered list of question definitions.
    - Every referenced phase must already exist in event.rounds.
    - EventManagers may only manage events assigned to them.

    Body example:
    ```json
    {
      "questions": {
        "phase1": [
          {
            "question_id": "q1",
            "question_text": "Your GitHub repo URL",
            "question_type": "url",
            "required": true
          }
        ]
      }
    }
    ```
    """
    # EventManager scope check
    if admin.role == AdminRole.EVENT_MANAGER:
        assigned = [str(e) for e in (admin.events or [])]
        if event_id not in assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not manage this event.",
            )

    event = await set_questions_for_event(supabase, event_id, payload)

    # Build response: convert stored dicts back to QuestionDefinition for serialisation
    from app.schemas.question import QuestionDefinition
    response_questions = {
        phase_key: [QuestionDefinition.model_validate(q) for q in qs]
        for phase_key, qs in (event.questions or {}).items()
    }

    return EventQuestionsResponse(
        event_id=str(event.id),
        questions=response_questions,
        message="Questions updated successfully",
    )
