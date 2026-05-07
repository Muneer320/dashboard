from fastapi import APIRouter, BackgroundTasks, Depends, Request
from supabase import AsyncClient
from app.core.limiter import limiter

from app.api.deps import get_admin_or_em, get_current_user
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.models.user import User
from app.schemas.submission import SubmissionFetchResponse, SubmissionRequest, SubmissionResponse
from app.services.event_service import auto_lock_expired_phases, get_event
from app.services.submission_service import get_submission_for_phase, submit_for_event

router = APIRouter()


@router.post("/{event_id}/submit", response_model=SubmissionResponse, status_code=201)
@limiter.limit("50/minute")
async def submit_event(
    request: Request,
    event_id: str,
    payload: SubmissionRequest,
    background_tasks: BackgroundTasks,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """
    Submit answers for a specific event phase.

    Body:
        phase    int          >= 1
        answers  list[{question_id, answer}]

    All required questions must be answered; the phase must be active and
    unlocked. Re-submitting overwrites the previous answers for that phase.
    """
    event = await get_event(supabase, event_id)
    submitted_at, normalised = await submit_for_event(
        supabase=supabase,
        user=current_user,
        event=event,
        phase=payload.phase,
        answers=payload.answers,
    )
    background_tasks.add_task(auto_lock_expired_phases, supabase, event)
    phase_key = f"phase{payload.phase}"
    return SubmissionResponse(
        message="Submission accepted",
        event_id=str(event.id),
        phase=payload.phase,
        phase_key=phase_key,
        submitted_at=submitted_at,
        answers=normalised,
    )


@router.get("/{event_id}/submission", response_model=SubmissionFetchResponse)
async def get_submission(
    event_id: str,
    phase: int,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> SubmissionFetchResponse:
    """Return the calling user's stored answers for a given event phase."""
    event = await get_event(supabase, event_id)
    data = get_submission_for_phase(current_user, event, phase)
    return SubmissionFetchResponse(**data)
