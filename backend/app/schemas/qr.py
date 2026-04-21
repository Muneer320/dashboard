from pydantic import BaseModel, Field, field_validator


# Accepted mode names. ``collegeEntry`` / ``event`` are the historical names;
# ``entry`` / ``attendance`` are what the admin-panel frontend sends.
_MODE_ALIASES = {
    "entry": "collegeEntry",
    "collegeEntry": "collegeEntry",
    "attendance": "event",
    "event": "event",
    "food": "food",
}


class QRScanRequest(BaseModel):
    user_id: str
    mode: str
    meal: str | None = Field(default=None, pattern=r"^meal\d+$")
    event_id: str | None = None

    @field_validator("mode")
    @classmethod
    def _canonicalise_mode(cls, v: str) -> str:
        canonical = _MODE_ALIASES.get(v)
        if canonical is None:
            raise ValueError(
                "mode must be one of: food, event, collegeEntry "
                "(or aliases: entry, attendance)"
            )
        return canonical


class QRScanResponse(BaseModel):
    message: str
    status: str
