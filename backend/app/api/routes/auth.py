from fastapi import APIRouter, Depends
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, RegisterResponse, TokenResponse
from app.services.auth_service import login_with_credentials, register_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    supabase: AsyncClient = Depends(get_supabase),
) -> TokenResponse:
    # payload.email is the user's email address, which organisers set as the username
    token = await login_with_credentials(supabase, payload.email, payload.password)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=RegisterResponse)
async def register(
    payload: RegisterRequest,
    supabase: AsyncClient = Depends(get_supabase),
) -> RegisterResponse:
    user = await register_user(
        supabase=supabase,
        username=payload.username,
        password=payload.password,
        name=payload.name,
        unstop_id=payload.unstop_id,
    )
    return RegisterResponse(id=str(user.id), username=user.username, name=user.name)


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        id=str(current_user.id),
        username=current_user.username,
        name=current_user.name,
        is_attending=current_user.is_attending,
    )
