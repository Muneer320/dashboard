import httpx
from fastapi import APIRouter, HTTPException, Query, status

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

    return {"status": "ok", "db": "ok"}
