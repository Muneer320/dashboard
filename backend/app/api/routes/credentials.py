"""
Credentials-request route
─────────────────────────────────────────────────────
POST /credentials-requests    open (no auth)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.credentials import CredentialsRequest, CredentialsResponse
from app.services.credentials_service import create_credentials_request

router = APIRouter()


@router.post("", response_model=CredentialsResponse, status_code=201)
async def request_credentials(
    body: CredentialsRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CredentialsResponse:
    """
    Submit a credential request from the /credentials page.

    No authentication required — this is the pre-login gate for participants
    who don't yet have an account. Organizers review submissions in the admin panel.
    Returns a ticket ID the user can reference when following up.
    """
    data = await create_credentials_request(
        session,
        name=body.name,
        college=body.college,
        email=body.email,
        phone=body.phone,
        events_of_interest=body.events_of_interest,
        note=body.note,
    )
    return CredentialsResponse(**data)
