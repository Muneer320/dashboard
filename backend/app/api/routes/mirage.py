from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import get_mirage_supabase
from app.models.user import User
from app.schemas.mirage import (
    MirageCollectionDetailResponse,
    MirageGalleryDayItem,
    MirageLikeResponse,
    MirageOverviewResponse,
)
from app.services.mirage_service import (
    get_collection_detail,
    get_drive_file_payload,
    get_overview_payload,
    list_public_gallery,
    toggle_photo_like,
)

router = APIRouter()


@router.get("/gallery", response_model=list[MirageGalleryDayItem])
async def get_gallery(
    supabase: AsyncClient = Depends(get_mirage_supabase),
    user: User = Depends(get_current_user),
) -> list[MirageGalleryDayItem]:
    items = await list_public_gallery(supabase, user)
    return [MirageGalleryDayItem(**item) for item in items]


@router.get("/overview", response_model=MirageOverviewResponse)
async def get_overview(
    supabase: AsyncClient = Depends(get_mirage_supabase),
    user: User = Depends(get_current_user),
) -> MirageOverviewResponse:
    payload = await get_overview_payload(supabase, user)
    return MirageOverviewResponse(**payload)


@router.get("/collections/{collection_id}", response_model=MirageCollectionDetailResponse)
async def get_collection(
    collection_id: str,
    supabase: AsyncClient = Depends(get_mirage_supabase),
    user: User = Depends(get_current_user),
) -> MirageCollectionDetailResponse:
    payload = await get_collection_detail(supabase, collection_id, user)
    return MirageCollectionDetailResponse(**payload)


@router.post("/photos/{photo_id}/like", response_model=MirageLikeResponse)
async def like_photo(
    photo_id: str,
    supabase: AsyncClient = Depends(get_mirage_supabase),
    user: User = Depends(get_current_user),
) -> MirageLikeResponse:
    payload = await toggle_photo_like(supabase, photo_id, user)
    return MirageLikeResponse(**payload)


@router.get("/files/{file_id}")
async def get_file(
    file_id: str,
    name: str | None = Query(None),
    mime: str | None = Query(None),
) -> Response:
    content, mime_type, resolved_name = await get_drive_file_payload(
        file_id,
        fallback_name=name,
        fallback_mime_type=mime,
    )
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "Content-Disposition": f'inline; filename="{resolved_name}"',
        },
    )
