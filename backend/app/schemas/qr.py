from pydantic import BaseModel, field_validator


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
    event_id: str | None = None
    # ``meal`` is accepted for backward compatibility with older clients but
    # is ignored — the backend now auto-assigns the next meal slot based on
    # the user's remaining allowance across their registered events.
    meal: str | None = None

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
