import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi_cache import FastAPICache

from app.core.config import settings
from app.db.supabase_client import get_client

router = APIRouter()


@router.get("/health")
async def health_check(
    deep: bool = Query(
        False,
        description="When true, also checks the database REST layer (PostgREST/Supabase).",
    )
) -> dict[str, str]:
    if not deep:
        return {"status": "ok"}

    try:
        supabase = await get_client()
        # Lightweight ping: any table works; users exists in all environments.
        await supabase.table("users").select("id").limit(1).execute()
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Database REST API unreachable (PostgREST/Supabase). "
                "Check SUPABASE_URL and that the REST gateway is running. "
                f"Original error: {exc}"
            ),
        ) from exc

    response: dict[str, str] = {"status": "ok", "db": "ok"}
    try:
        backend = FastAPICache.get_backend()
        response["cache"] = backend.__class__.__name__
    except Exception:
        response["cache"] = "unknown"
    if settings.REDIS_URL:
        response["redis_configured"] = "yes"

    return response
