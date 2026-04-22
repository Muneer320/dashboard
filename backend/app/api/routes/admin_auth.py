from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import AsyncClient

from app.api.deps import get_current_admin
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.schemas.auth import TokenResponse
from app.services.admin_auth_service import admin_login

router = APIRouter()


class AdminMeResponse(BaseModel):
    uid: int
    username: str
    name: str
    role: str
    mail: str | None
    events: list[str] = []


class AdminLoginRequest(BaseModel):
    """Admin panel login — uses username (not email) to authenticate."""
    username: str
    password: str


@router.post("/login", response_model=TokenResponse)
async def admin_login_endpoint(
    payload: AdminLoginRequest,
    supabase: AsyncClient = Depends(get_supabase),
) -> TokenResponse:
    """Login for admin, eventManager, and scanner accounts."""
    token = await admin_login(supabase, payload.username, payload.password)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=AdminMeResponse)
async def admin_me(
    current_admin: Admin = Depends(get_current_admin),
) -> AdminMeResponse:
    """Returns the logged-in admin's profile."""
    return AdminMeResponse(
        uid=current_admin.uid,
        username=current_admin.username,
        name=current_admin.name,
        role=current_admin.role.value,
        mail=current_admin.mail,
        events=current_admin.events or [],
    )
