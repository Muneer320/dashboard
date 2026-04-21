"""
Feedback route
─────────────────────────────────────────────────────────────────────────────
POST /feedback      → submit anonymous overall-festival feedback (authed user)

The user must be logged in (to stop bots), but the row never stores who they
were. This is the "be honest" channel from the /feedback page.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.feedback import FeedbackResponse, FeedbackSubmit
from app.services.feedback_service import create_feedback

router = APIRouter()


@router.post("", response_model=FeedbackResponse, status_code=201)
async def post_feedback(
    body: FeedbackSubmit,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> FeedbackResponse:
    """
    Submit anonymous overall-festival feedback (sliders + two free-text fields).

    The JWT is verified so only authenticated participants can submit, but
    user_id is deliberately not persisted — the submission is anonymous once
    it lands in the database.
    """
    data = await create_feedback(
        session,
        scores=body.scores.model_dump(),
        fix=body.fix,
        highlight=body.highlight,
    )
    return FeedbackResponse(**data)
