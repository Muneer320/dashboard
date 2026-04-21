"""
Ratings routes (mounted under /events)
─────────────────────────────────────────────────────────────────────────────
POST /events/{event_id}/rating          → submit / update rating   (user)
GET  /events/{event_id}/rating/me       → get own rating           (user)
GET  /events/{event_id}/rating/summary  → aggregate avg + count    (user)
"""
from fastapi import APIRouter, Depends
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase
from app.models.user import User
from app.schemas.rating import RatingResponse, RatingSubmit, RatingSummary
from app.services.rating_service import get_my_rating, get_rating_summary, submit_rating

router = APIRouter()


@router.post("/{event_id}/rating", response_model=RatingResponse, status_code=201)
async def post_rating(
    event_id: str,
    body: RatingSubmit,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> RatingResponse:
    """
    Submit or update a star rating (1–5) and optional text feedback for an event.
    Calling again overwrites the previous rating.
    """
    data = await submit_rating(
        supabase,
        user_id=str(current_user.id),
        event_id=event_id,
        value=body.value,
        feedback=body.feedback,
    )
    return RatingResponse(**data)


@router.get("/{event_id}/rating/me", response_model=RatingResponse | None)
async def my_rating(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> RatingResponse | None:
    """
    Return the current user's rating for this event, or null if not yet rated.
    """
    data = await get_my_rating(supabase, str(current_user.id), event_id)
    if data is None:
        return None
    return RatingResponse(**data)


@router.get("/{event_id}/rating/summary", response_model=RatingSummary)
async def rating_summary(
    event_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> RatingSummary:
    """
    Return the aggregate average star rating and total review count for an event.
    """
    data = await get_rating_summary(supabase, event_id)
    return RatingSummary(**data)
