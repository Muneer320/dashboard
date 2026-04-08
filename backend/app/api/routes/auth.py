from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, RegisterResponse, TokenResponse
from app.services.auth_service import login_with_credentials, register_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    token = await login_with_credentials(session, payload.username, payload.password)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=RegisterResponse)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db_session)) -> RegisterResponse:
    user = await register_user(
        session=session,
        username=payload.username,
        password=payload.password,
        name=payload.name,
        unstop_id=payload.unstop_id,
    )
    return RegisterResponse(id=str(user.id), username=user.username, name=user.name, role=user.role.value)


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        id=str(current_user.id),
        username=current_user.username,
        name=current_user.name,
        role=current_user.role.value,
    )
