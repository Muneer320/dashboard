from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.submission import SubmissionFetchResponse, SubmissionRequest, SubmissionResponse
from app.services.event_service import get_event
from app.services.submission_service import get_submission_for_phase, submit_for_event

router = APIRouter()


@router.post("/{event_id}/submit", response_model=SubmissionResponse)
async def submit_event(
    event_id: str,
    payload: SubmissionRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    event = await get_event(session, event_id)
    submitted_at = await submit_for_event(
        session=session,
        user=current_user,
        event=event,
        phase=payload.phase,
        submission_type=payload.submission_type,
        value=payload.value,
    )
    return SubmissionResponse(
        message="Submission accepted",
        event_id=str(event.id),
        phase=payload.phase,
        submitted_at=submitted_at,
    )


@router.get("/{event_id}/submission", response_model=SubmissionFetchResponse)
async def get_submission(
    event_id: str,
    phase: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SubmissionFetchResponse:
    event = await get_event(session, event_id)
    payload = get_submission_for_phase(current_user, event, phase)
    return SubmissionFetchResponse(**payload)
