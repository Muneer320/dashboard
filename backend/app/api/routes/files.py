from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("/{token}")
async def download_file(token: str) -> dict:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Local file route is deprecated. Use Supabase signed URLs returned at submission time.",
    )
