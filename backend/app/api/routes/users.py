from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from supabase import AsyncClient

from app.api.deps import get_admin_only, get_current_user
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.schemas.mirage import (
    MirageAnchorImageItem,
    MirageUserProfileResponse,
    MirageUserProfileSubmitRequest,
)
from app.models.user import User
from app.schemas.meals import MealSlot
from app.schemas.user import (
    MyEventResponse,
    MyLeaderboardResponse,
    UserEventsResponse,
    UserProfileUpdate,
    UserResponse,
)
from app.services.event_service import get_event_registration_counts, list_events
from app.services.mirage_pipeline_service import (
    delete_mirage_anchor_image,
    get_mirage_profile,
    submit_mirage_profile,
    upload_mirage_anchor_image,
)
from app.services.qr_service import scan_food
from app.services.user_service import (
    build_my_leaderboard_payload,
    get_user_by_id,
    get_user_events_payload,
    update_user_profile,
)

router = APIRouter()


def _require_mirage_attendee(user: User) -> None:
    if not user.is_attending:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mirage is only available for attendees.",
        )


def _build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        username=user.username,
        name=user.name,
        is_attending=user.is_attending,
        details=user.details or {},
        events=user.events or {},
        food=user.food or {},
        is_profile_complete=user.is_profile_complete,
        cents=user.cents,
    )


@router.get("/me/my-events", response_model=list[MyEventResponse])
async def get_my_events(
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> list[MyEventResponse]:
    """Return full event details for every event the calling user is registered for."""
    user_events = current_user.events or {}
    if not user_events:
        return []

    # Fetch all events and filter to those the user is part of
    all_events = await list_events(supabase)
    event_map = {str(ev.id): ev for ev in all_events}
    counts = await get_event_registration_counts(supabase, list(user_events.keys()))

    results = []
    for event_id, user_status in user_events.items():
        ev = event_map.get(event_id)
        if ev is None:
            continue
        results.append(MyEventResponse(
            id=str(ev.id),
            name=ev.name,
            description=ev.description or "",
            venue=ev.venue or [],
            participants_count=counts.get(event_id, 0),
            user_status=user_status if isinstance(user_status, dict) else {},
        ))
    return results


@router.get("/me/leaderboard", response_model=MyLeaderboardResponse)
async def get_my_leaderboard(
    top_limit: int = 100,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> MyLeaderboardResponse:
    """
    Combined leaderboard payload:
    - Global ranking of all users by cents.
    - Event-wise rankings for events the current user is enrolled in.
    """
    top_limit = max(1, min(top_limit, 200))
    all_events = await list_events(supabase)
    payload = await build_my_leaderboard_payload(
        supabase=supabase,
        current_user=current_user,
        all_events=all_events,
        top_limit=top_limit,
    )
    return MyLeaderboardResponse(**payload)


@router.get("/me/mirage/profile", response_model=MirageUserProfileResponse)
async def get_my_mirage_profile(
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> MirageUserProfileResponse:
    _require_mirage_attendee(current_user)
    payload = await get_mirage_profile(supabase, current_user)
    return MirageUserProfileResponse(**payload)


@router.post("/me/mirage/images", response_model=MirageAnchorImageItem, status_code=201)
async def post_my_mirage_image(
    file: UploadFile = File(...),
    poseLabel: str | None = Form(None),
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> MirageAnchorImageItem:
    _require_mirage_attendee(current_user)
    payload = await upload_mirage_anchor_image(supabase, current_user, file, poseLabel)
    return MirageAnchorImageItem(**payload)


@router.delete("/me/mirage/images/{image_id}", status_code=204)
async def remove_my_mirage_image(
    image_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_mirage_attendee(current_user)
    await delete_mirage_anchor_image(supabase, current_user, image_id)


@router.post("/me/mirage/profile/submit", response_model=MirageUserProfileResponse)
async def submit_my_mirage_profile(
    body: MirageUserProfileSubmitRequest,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> MirageUserProfileResponse:
    _require_mirage_attendee(current_user)
    payload = await submit_mirage_profile(supabase, current_user, body.consentEnabled)
    return MirageUserProfileResponse(**payload)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    # Users can only fetch their own profile; admins (via Admin JWT) can fetch anyone
    if str(current_user.id) != user_id:
        user = await get_user_by_id(supabase, user_id)
    else:
        user = current_user
    return _build_user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: str,
    payload: UserProfileUpdate,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    if str(current_user.id) != user_id:
        # Non-matching ID falls back to updating the calling user's own profile
        user = current_user
    else:
        user = await get_user_by_id(supabase, user_id)

    updated = await update_user_profile(
        supabase, user, payload.model_dump(exclude_unset=True)
    )
    return _build_user_response(updated)


@router.get("/{user_id}/events", response_model=UserEventsResponse)
async def get_user_events(
    user_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> UserEventsResponse:
    if str(current_user.id) != user_id:
        user = current_user
    else:
        user = await get_user_by_id(supabase, user_id)

    payload = get_user_events_payload(user)
    return UserEventsResponse(**payload)


# ── Meals ──────────────────────────────────────────────────────────────────────

_MEAL_LABELS: dict[str, str] = {
    "meal1": "Breakfast",
    "meal2": "Lunch",
    "meal3": "Dinner",
}


@router.get("/{user_id}/meals", response_model=list[MealSlot])
async def get_user_meals(
    user_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    current_user: User = Depends(get_current_user),
) -> list[MealSlot]:
    """
    Return the three meal slots and their collection status for a user.
    Users may only read their own meals.
    """
    if str(current_user.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own meal status",
        )
    food = current_user.food or {"meal1": False, "meal2": False, "meal3": False}
    return [
        MealSlot(slot=slot, label=label, collected=bool(food.get(slot, False)))
        for slot, label in _MEAL_LABELS.items()
    ]


class _MealMarkBody(BaseModel):
    meal: str   # "meal1" | "meal2" | "meal3"


@router.post("/{user_id}/meals/mark", response_model=list[MealSlot])
async def admin_mark_meal(
    user_id: str,
    body: _MealMarkBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> list[MealSlot]:
    """
    Admin-only: manually mark a meal slot as collected for a user.
    Useful when the QR scanner is unavailable.
    """
    if body.meal not in _MEAL_LABELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid meal slot '{body.meal}'. Must be one of: "
                f"{list(_MEAL_LABELS)}"
            ),
        )
    target = await get_user_by_id(supabase, user_id)
    await scan_food(supabase, target, body.meal)
    food = target.food or {"meal1": False, "meal2": False, "meal3": False}
    return [
        MealSlot(slot=slot, label=label, collected=bool(food.get(slot, False)))
        for slot, label in _MEAL_LABELS.items()
    ]
