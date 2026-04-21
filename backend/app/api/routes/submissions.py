from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase
from app.models.user import User
from app.schemas.submission import SubmissionFetchResponse, SubmissionRequest, SubmissionResponse
from app.services.event_service import get_event
from app.services.submission_service import get_submission_for_phase, submit_for_event

router = APIRouter()


@router.post("/{event_id}/submit", response_model=SubmissionResponse, status_code=201)
async def submit_event(
    event_id: str,
    payload: SubmissionRequest,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """
    Submit repo and/or deploy links for a specific event phase.

    Body:
        phase       int   ≥ 1
        repo_link   str   GitHub / other repo URL  (optional if deploy_link given)
        deploy_link str   Live deployment URL       (optional if repo_link given)

    At least one link must be non-empty.
    Calling again on the same phase overwrites the previous submission.
    """
    if not payload.has_content():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of repo_link or deploy_link",
        )

    event = await get_event(supabase, event_id)
    submitted_at, links = await submit_for_event(
        supabase=supabase,
        user=current_user,
        event=event,
        phase=payload.phase,
        repo_link=payload.repo_link,
        deploy_link=payload.deploy_link,
    )
    return SubmissionResponse(
        message="Submission accepted",
        event_id=str(event.id),
        phase=payload.phase,
        submitted_at=submitted_at,
        submission=links,
    )


@router.get("/{event_id}/submission", response_model=SubmissionFetchResponse)
async def get_submission(
    event_id: str,
    phase: int,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> SubmissionFetchResponse:
    """Return the current submission for a given event phase, or null if none."""
    event = await get_event(supabase, event_id)
    payload = get_submission_for_phase(current_user, event, phase)
    return SubmissionFetchResponse(**payload)
