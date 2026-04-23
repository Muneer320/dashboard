"""
Credentials-request route
─────────────────────────────────────────────────────
POST /credentials-requests           open (no auth)  submit a request
GET  /credentials-requests/events    open (no auth)  list {id, name} so the
                                                     pre-login page can show
                                                     real event options.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import get_supabase, rows
from app.schemas.credentials import CredentialsRequest, CredentialsResponse
from app.services.credentials_service import (
    DuplicateCredentialsRequest,
    create_credentials_request,
)

router = APIRouter()


@router.get("/events")
async def list_public_events(
    supabase: AsyncClient = Depends(get_supabase),
) -> list[dict]:
    """
    Public, name-only event list for the /credentials form.

    Returns ``[{id, name}]`` and nothing else — this endpoint has no auth so
    it must not leak venue, timings, description, or participant counts.
    Ordered alphabetically so the chip list is stable across loads.
    """
    resp = await (
        supabase.table("events")
        .select("id, name")
        .order("name")
        .execute()
    )
    return [
        {"id": str(r["id"]), "name": r.get("name") or ""}
        for r in rows(resp)
        if r.get("name")
    ]


@router.post("", response_model=CredentialsResponse, status_code=201)
async def request_credentials(
    body: CredentialsRequest,
    supabase: AsyncClient = Depends(get_supabase),
) -> CredentialsResponse:
    """
    Submit a credential request from the /credentials page.

    No authentication required — this is the pre-login gate for participants
    who don't yet have an account. Organizers review submissions in the admin panel.
    Returns a ticket ID the user can reference when following up.

    Responds with **409 Conflict** if this email already has an active
    (pending or approved) request on file. The existing ticket_id and status
    are echoed back in the error detail so the UI can show them.
    """
    try:
        data = await create_credentials_request(
            supabase,
            name=body.name,
            college=body.college,
            email=body.email,
            phone=body.phone,
            events_of_interest=body.events_of_interest,
            note=body.note,
        )
    except DuplicateCredentialsRequest as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "A credentials request for this email is already on file. "
                    "Please wait for review instead of resubmitting."
                ),
                "ticket_id": exc.ticket_id,
                "status": exc.status,
            },
        )
    return CredentialsResponse(**data)
