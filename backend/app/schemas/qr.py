from pydantic import BaseModel, Field


class QRScanRequest(BaseModel):
    user_id: str
    mode: str = Field(pattern="^(food|event)$")
    meal: str | None = Field(default=None, pattern="^(meal1|meal2|meal3)$")
    event_id: str | None = None
    phase: int | None = Field(default=None, ge=1)


class QRScanResponse(BaseModel):
    message: str
    status: str
