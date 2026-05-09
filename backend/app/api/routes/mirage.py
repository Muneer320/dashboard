from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase
from app.models.user import User
from app.schemas.mirage import (
    MirageCollectionDetailResponse,
    MirageGalleryDayItem,
    MirageLikeResponse,
    MirageOverviewResponse,
    MiragePhotoItem,
)
from app.services.mirage_pipeline_service import (
    get_collection_detail,
    get_drive_file_payload,
    get_overview_payload,
    list_my_mirage_photos,
    list_public_gallery,
    toggle_photo_like,
    verify_drive_file_signature,
)

router = APIRouter()


@router.get("/gallery", response_model=list[MirageGalleryDayItem])
async def get_gallery(
    supabase: AsyncClient = Depends(get_supabase),
    user: User = Depends(get_current_user),
) -> list[MirageGalleryDayItem]:
    items = await list_public_gallery(supabase, user)
    return [MirageGalleryDayItem(**item) for item in items]


@router.get("/overview", response_model=MirageOverviewResponse)
async def get_overview(
    supabase: AsyncClient = Depends(get_supabase),
    user: User = Depends(get_current_user),
) -> MirageOverviewResponse:
    payload = await get_overview_payload(supabase, user)
    return MirageOverviewResponse(**payload)


@router.get("/collections/{collection_id}", response_model=MirageCollectionDetailResponse)
async def get_collection(
    collection_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    user: User = Depends(get_current_user),
) -> MirageCollectionDetailResponse:
    payload = await get_collection_detail(supabase, collection_id, user)
    return MirageCollectionDetailResponse(**payload)


@router.post("/photos/{photo_id}/like", response_model=MirageLikeResponse)
async def like_photo(
    photo_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    user: User = Depends(get_current_user),
) -> MirageLikeResponse:
    payload = await toggle_photo_like(supabase, photo_id, user)
    return MirageLikeResponse(**payload)


@router.get("/me/photos", response_model=list[MiragePhotoItem])
async def get_my_photos(
    supabase: AsyncClient = Depends(get_supabase),
    user: User = Depends(get_current_user),
) -> list[MiragePhotoItem]:
    items = await list_my_mirage_photos(supabase, user)
    return [MiragePhotoItem(**item) for item in items]


@router.get("/files/{file_id}")
async def get_file(
    file_id: str,
    name: str | None = Query(None),
    mime: str | None = Query(None),
    w: int | None = Query(None, ge=64, le=4096),
    q: int = Query(82, ge=1, le=95),
    exp: int = Query(..., ge=1),
    sig: str = Query(..., min_length=32, max_length=128),
) -> Response:
    resolved_name = name or file_id
    resolved_mime = mime or "image/jpeg"
    if not verify_drive_file_signature(
        file_id=file_id,
        name=resolved_name,
        mime_type=resolved_mime,
        width=w,
        quality=q,
        expires_at=exp,
        signature=sig,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired Mirage file signature.",
        )
    content, mime_type, resolved_name = await get_drive_file_payload(
        file_id,
        fallback_name=resolved_name,
        fallback_mime_type=resolved_mime,
        max_width=w,
        quality=q,
    )
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
            "Content-Disposition": f'inline; filename="{resolved_name}"',
        },
    )
