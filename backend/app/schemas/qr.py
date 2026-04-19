from pydantic import BaseModel, Field


class QRScanRequest(BaseModel):
    user_id: str
    mode: str = Field(pattern="^(food|event|collegeEntry)$")
    meal: str | None = Field(default=None, pattern="^(meal1|meal2|meal3)$")
    event_id: str | None = None


class QRScanResponse(BaseModel):
    message: str
    status: str
