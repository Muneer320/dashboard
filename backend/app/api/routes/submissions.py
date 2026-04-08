from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.submission import SubmissionFetchResponse, SubmissionRequest, SubmissionResponse
from app.services.event_service import get_event
from app.services.file_storage import save_submission_file
from app.services.submission_service import get_submission_for_phase, submit_for_event

router = APIRouter()


@router.post("/{event_id}/submit", response_model=SubmissionResponse)
async def submit_event(
    event_id: str,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    event = await get_event(session, event_id)
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        phase = int(form.get("phase", 0))
        submission_type = str(form.get("submission_type", "file"))
        file_upload = form.get("file")
        value = str(form.get("value", ""))

        if submission_type not in {"url", "file"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid submission type")

        if submission_type == "file":
            if file_upload is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="File upload is required")
            file_reference = await save_submission_file(str(event.id), str(current_user.id), file_upload)
            value = file_reference.signed_url
        elif not value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="value is required for url submissions")
    else:
        payload = SubmissionRequest.model_validate(await request.json())
        phase = payload.phase
        submission_type = payload.submission_type
        value = payload.value

    submitted_at = await submit_for_event(
        session=session,
        user=current_user,
        event=event,
        phase=phase,
        submission_type=submission_type,
        value=value,
    )
    return SubmissionResponse(
        message="Submission accepted",
        event_id=str(event.id),
        phase=phase,
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
