from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.user import UserProfileUpdate, UserResponse
from app.services.user_service import get_user_by_id, update_user_profile

router = APIRouter()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, session: AsyncSession = Depends(get_db_session), _: User = Depends(get_current_user)) -> UserResponse:
    user = await get_user_by_id(session, user_id)
    return UserResponse(
        id=str(user.id),
        username=user.username,
        name=user.name,
        details=user.details or {},
        events=user.events or {},
        food=user.food or {},
        access_level=user.access_level.value,
        role=user.role.value,
        is_profile_complete=user.is_profile_complete,
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: str,
    payload: UserProfileUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = await get_user_by_id(session, user_id)

    if str(current_user.id) != str(user.id) and current_user.role.value != "admin":
        user = current_user

    updated = await update_user_profile(session, user, payload.model_dump(exclude_unset=True))
    return UserResponse(
        id=str(updated.id),
        username=updated.username,
        name=updated.name,
        details=updated.details or {},
        events=updated.events or {},
        food=updated.food or {},
        access_level=updated.access_level.value,
        role=updated.role.value,
        is_profile_complete=updated.is_profile_complete,
    )
