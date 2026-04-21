from pydantic import BaseModel, EmailStr


class CredentialsRequest(BaseModel):
    name: str
    college: str
    email: str
    phone: str
    events_of_interest: list[str] = []
    note: str | None = None


class CredentialsResponse(BaseModel):
    ticket_id: str
    status: str
