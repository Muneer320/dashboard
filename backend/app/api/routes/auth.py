from fastapi import APIRouter, Depends, Request
from supabase import AsyncClient
from app.core.limiter import limiter

from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, RegisterResponse, TokenResponse, VisitorSignupRequest, VisitorSignupResponse
from app.services.auth_service import login_with_credentials, register_user, visitor_signup_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("50/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    supabase: AsyncClient = Depends(get_supabase),
) -> TokenResponse:
    # payload.email is the user's email address, which organisers set as the username
    token = await login_with_credentials(supabase, payload.email, payload.password)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("50/minute")
async def register(
    request: Request,
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
        role=current_user.role,
        details=current_user.details,
    )


@router.post("/visitor-signup", response_model=VisitorSignupResponse, status_code=201)
@limiter.limit("10/minute")
async def visitor_signup(
    request: Request,
    payload: VisitorSignupRequest,
    supabase: AsyncClient = Depends(get_supabase),
) -> VisitorSignupResponse:
    """
    Public self-registration for walk-in visitors.
    Creates a user row with role='visitor', events={}, food={},
    and returns a JWT so the visitor is immediately logged in.
    """
    user, access_token = await visitor_signup_user(
        supabase=supabase,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        phone=payload.phone,
        college=payload.college,
        city=payload.city,
        branch=payload.branch,
        year=payload.year,
        gender=payload.gender,
        emergency_contact=payload.emergency_contact,
    )
    return VisitorSignupResponse(
        id=str(user.id),
        username=user.username,
        name=user.name,
        access_token=access_token,
    )
