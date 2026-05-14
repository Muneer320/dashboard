from __future__ import annotations

import asyncio
import json
import re
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from hashlib import sha256
from urllib.parse import quote

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.config import settings
from app.db.mirage_postgres import mirage_connection
from app.db.supabase_client import first_row, get_client, rows
from app.models.user import User
from app.services.mirage_drive_service import (
    DriveImageFile,
    drive_file_view_url,
    list_folder_images,
    parse_drive_folder_id,
    public_drive_file_url,
)

_SYNC_INTERVAL_SECONDS = 15 * 60
_COLLECTION_PREVIEW_LIMIT = 8
_COLLECTION_HIGHLIGHT_LIMIT = 3
_OVERVIEW_HIGHLIGHT_LIMIT = 8
_TRENDING_LIMIT = 12


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "mirage-section"


def _chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def _metadata_from_row(row: dict) -> dict:
    raw = row.get("description")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {"dayLabel": str(raw)}


def _metadata_to_description(metadata: dict) -> str:
    return json.dumps(metadata, separators=(",", ":"))


def _drive_thumbnail_url(file_id: str, *, width: int = 1000) -> str:
    return f"https://drive.google.com/thumbnail?id={quote(file_id)}&sz=w{int(width)}"


def _photo_proxy_url(file_id: str, name: str, mime_type: str) -> str:
    return (
        f"{settings.API_V1_PREFIX}/mirage/files/{file_id}"
        f"?name={quote(name, safe='')}&mime={quote(mime_type, safe='')}&w=1000&q=82"
    )


def _user_like_hash(user: User) -> str:
    return sha256(f"mirage-like:{user.id}".encode("utf-8")).hexdigest()


def _is_sync_stale(metadata: dict) -> bool:
    raw = metadata.get("lastSyncedAt")
    if not raw:
        return True
    try:
        synced_at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - synced_at).total_seconds() > _SYNC_INTERVAL_SECONDS


def _base_row_payload(row: dict) -> dict:
    metadata = _metadata_from_row(row)
    try:
        drive_folder_id = parse_drive_folder_id(row.get("drive_folder_url") or "")
    except ValueError:
        drive_folder_id = ""
    return {
        "id": str(row["id"]),
        "dayLabel": metadata.get("dayLabel") or "Highlights",
        "sectionTitle": row.get("name") or "Untitled Section",
        "eventId": metadata.get("eventId") or str(row["id"]),
        "eventName": metadata.get("eventName") or row.get("name") or "Untitled Section",
        "driveFolderUrl": row.get("drive_folder_url") or "",
        "driveFolderId": drive_folder_id,
        "recursive": bool(metadata.get("recursive", False)),
        "sortOrder": int(row.get("sort_order", 0) or 0),
    }


def _photo_name(photo_row: dict, fallback_file: DriveImageFile | None = None) -> str:
    if fallback_file is not None and fallback_file.name:
        return fallback_file.name
    caption = (photo_row.get("caption") or "").strip()
    if caption:
        return caption
    drive_file_id = photo_row.get("drive_file_id")
    return drive_file_id or str(photo_row.get("id"))


def _photo_url_from_row(photo_row: dict, fallback_file: DriveImageFile | None = None) -> str:
    preview_url = photo_row.get("preview_url")
    if preview_url:
        return str(preview_url)
    drive_file_id = photo_row.get("drive_file_id")
    if drive_file_id:
        name = _photo_name(photo_row, fallback_file)
        mime_type = (fallback_file.mime_type if fallback_file else None) or "image/jpeg"
        return _photo_proxy_url(drive_file_id, name, mime_type)
    return photo_row.get("public_url") or ""


def _photo_thumbnail_url_from_row(photo_row: dict) -> str | None:
    thumbnail_url = photo_row.get("thumbnail_url")
    if thumbnail_url:
        return str(thumbnail_url)
    return None


def _photo_download_url_from_row(photo_row: dict, fallback_file: DriveImageFile | None = None) -> str | None:
    download_url = photo_row.get("download_url")
    if download_url:
        return str(download_url)
    drive_file_id = photo_row.get("drive_file_id") or (fallback_file.file_id if fallback_file else None)
    if drive_file_id:
        return public_drive_file_url(str(drive_file_id))
    return None


def _make_photo_item(
    *,
    photo_row: dict,
    file: DriveImageFile | None,
    base: dict,
    like_count: int = 0,
    liked: bool = False,
    trend_score: int | None = None,
    is_featured: bool = False,
) -> dict:
    name = _photo_name(photo_row, file)
    mime_type = (file.mime_type if file else None) or "image/jpeg"
    return {
        "photoId": str(photo_row["id"]),
        "fileId": photo_row.get("drive_file_id") or (file.file_id if file else str(photo_row["id"])),
        "name": name,
        "mimeType": mime_type,
        "url": _photo_url_from_row(photo_row, file),
        "downloadUrl": _photo_download_url_from_row(photo_row, file),
        "caption": photo_row.get("caption"),
        "width": photo_row.get("width"),
        "height": photo_row.get("height"),
        "likeCount": like_count,
        "liked": liked,
        "eventId": base.get("eventId"),
        "eventName": base.get("eventName"),
        "dayLabel": base.get("dayLabel"),
        "isFeatured": is_featured,
        "trendScore": trend_score,
        "thumbnailUrl": _photo_thumbnail_url_from_row(photo_row),
    }


async def _inspect_folder(
    folder_id: str,
    recursive: bool,
    *,
    limit: int | None = None,
) -> tuple[int, list[str]]:
    try:
        files = await asyncio.to_thread(
            list_folder_images,
            folder_id,
            recursive=recursive,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return len(files), [item.name for item in files[:3]]


async def _ensure_primary_event_exists(event_id: str | None) -> str | None:
    if not event_id:
        return None
    try:
        event_uuid = str(uuid.UUID(event_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid linked event ID.",
        ) from exc

    client = await get_client()
    response = await (
        client.table("events")
        .select("id")
        .eq("id", event_uuid)
        .limit(1)
        .execute()
    )
    if first_row(response) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked event not found in the main dashboard database.",
        )
    return event_uuid


async def _load_gallery_rows(supabase: AsyncClient, published_only: bool) -> list[dict]:
    query = (
        supabase.table("events")
        .select("id, slug, name, description, sort_order, is_published, drive_folder_url, cover_photo_id, created_at, updated_at")
        .not_.is_("drive_folder_url", "null")
        .order("sort_order")
        .order("name")
    )
    if published_only:
        query = query.eq("is_published", True)
    response = await query.execute()
    return rows(response)


async def _load_photo_rows_by_drive_ids(
    supabase: AsyncClient,
    file_ids: list[str],
) -> dict[str, dict]:
    if not file_ids:
        return {}
    result: dict[str, dict] = {}
    for chunk in _chunked(file_ids, 150):
        response = await (
            supabase.table("photos")
            .select("id, drive_file_id, public_url, caption, width, height, blurhash")
            .in_("drive_file_id", chunk)
            .execute()
        )
        for row in rows(response):
            if row.get("drive_file_id"):
                result[str(row["drive_file_id"])] = row
    return result


async def _load_live_asset_rows_by_drive_ids(file_ids: list[str]) -> dict[str, dict]:
    if not file_ids:
        return {}
    result: dict[str, dict] = {}
    try:
        async with mirage_connection() as connection:
            rows_pg = await connection.fetch(
                """
                with ranked as (
                    select
                        i.drive_file_id,
                        i.preview_public_url,
                        i.thumb_public_url,
                        i.download_url,
                        i.updated_at,
                        j.live_at,
                        row_number() over (
                            partition by i.drive_file_id
                            order by
                                case when j.gallery_visibility = 'live' then 0 else 1 end,
                                j.live_at desc nulls last,
                                i.updated_at desc nulls last,
                                i.created_at desc nulls last
                        ) as rank_index
                    from mirage_job_images i
                    join mirage_jobs j on j.id = i.job_id
                    where i.drive_file_id = any($1::text[])
                      and coalesce(i.preview_public_url, '') <> ''
                      and j.gallery_visibility = 'live'
                )
                select
                    drive_file_id,
                    preview_public_url,
                    thumb_public_url,
                    download_url
                from ranked
                where rank_index = 1
                """,
                file_ids,
            )
    except Exception:
        return {}

    for row in rows_pg:
        drive_file_id = row.get("drive_file_id")
        if not drive_file_id:
            continue
        result[str(drive_file_id)] = {
            "preview_url": row.get("preview_public_url"),
            "thumbnail_url": row.get("thumb_public_url"),
            "download_url": row.get("download_url"),
        }
    return result


async def _load_photo_rows_by_ids(
    supabase: AsyncClient,
    photo_ids: list[str],
) -> dict[str, dict]:
    if not photo_ids:
        return {}
    result: dict[str, dict] = {}
    for chunk in _chunked(photo_ids, 150):
        response = await (
            supabase.table("photos")
            .select("id, drive_file_id, public_url, caption, width, height, blurhash")
            .in_("id", chunk)
            .execute()
        )
        for row in rows(response):
            result[str(row["id"])] = row
    return result


async def _load_event_context_for_photo_ids(
    supabase: AsyncClient,
    photo_ids: list[str],
) -> dict[str, dict]:
    if not photo_ids:
        return {}
    mappings: dict[str, dict] = {}
    event_ids: set[str] = set()
    for chunk in _chunked(photo_ids, 150):
        response = await (
            supabase.table("event_photos")
            .select("photo_id, event_id, is_featured, sort_order")
            .in_("photo_id", chunk)
            .order("sort_order")
            .execute()
        )
        for row in rows(response):
            photo_id = str(row["photo_id"])
            if photo_id not in mappings:
                mappings[photo_id] = {
                    "eventId": str(row["event_id"]),
                    "isFeatured": bool(row.get("is_featured", False)),
                }
                event_ids.add(str(row["event_id"]))

    event_rows: dict[str, dict] = {}
    if event_ids:
        for chunk in _chunked(list(event_ids), 150):
            response = await (
                supabase.table("events")
                .select("id, name, description")
                .in_("id", chunk)
                .execute()
            )
            for row in rows(response):
                event_rows[str(row["id"])] = row

    for photo_id, context in mappings.items():
        event_row = event_rows.get(context["eventId"])
        if event_row:
            metadata = _metadata_from_row(event_row)
            context["eventName"] = metadata.get("eventName") or event_row.get("name")
            context["dayLabel"] = metadata.get("dayLabel")
    return mappings


async def _sync_section_assets(
    supabase: AsyncClient,
    row: dict,
    files: list[DriveImageFile],
) -> dict[str, dict]:
    file_ids = [file.file_id for file in files]
    photo_rows_by_drive_id = await _load_photo_rows_by_drive_ids(supabase, file_ids)
    live_asset_rows_by_drive_id = await _load_live_asset_rows_by_drive_ids(file_ids)
    metadata = _metadata_from_row(row)
    requires_refresh = _is_sync_stale(metadata) or len(photo_rows_by_drive_id) != len(file_ids)

    missing_rows = [
        {
            "external_photo_id": f"drive:{file.file_id}",
            "drive_file_id": file.file_id,
            "public_url": drive_file_view_url(file.file_id),
            "caption": file.name,
            "is_published": True,
            "moderation_status": "approved",
        }
        for file in files
        if file.file_id not in photo_rows_by_drive_id
    ]
    for chunk in _chunked([json.dumps(item) for item in missing_rows], 100):
        records = [json.loads(item) for item in chunk]
        if records:
            await supabase.table("photos").insert(records).execute()

    if missing_rows:
        photo_rows_by_drive_id = await _load_photo_rows_by_drive_ids(supabase, file_ids)
        requires_refresh = True

    photo_updates: list[dict] = []
    for file_id, photo_row in list(photo_rows_by_drive_id.items()):
        asset_row = live_asset_rows_by_drive_id.get(file_id)
        if asset_row is None:
            continue
        merged = {**photo_row, **asset_row}
        photo_rows_by_drive_id[file_id] = merged
        next_public_url = asset_row.get("preview_url")
        if next_public_url and photo_row.get("public_url") != next_public_url:
            photo_updates.append(
                {
                    "id": photo_row["id"],
                    "public_url": next_public_url,
                    "updated_at": _utcnow_iso(),
                }
            )
    for chunk in _chunked([json.dumps(item) for item in photo_updates], 100):
        records = [json.loads(item) for item in chunk]
        if records:
            await supabase.table("photos").upsert(records, on_conflict="id").execute()

    if requires_refresh:
        event_id = str(row["id"])
        await supabase.table("event_photos").delete().eq("event_id", event_id).execute()
        mappings = []
        for index, file in enumerate(files):
            photo_row = photo_rows_by_drive_id.get(file.file_id)
            if not photo_row:
                continue
            mappings.append(
                {
                    "event_id": event_id,
                    "photo_id": photo_row["id"],
                    "sort_order": index,
                    "is_featured": index < _COLLECTION_HIGHLIGHT_LIMIT,
                }
            )
        for chunk in _chunked([json.dumps(item) for item in mappings], 100):
            records = [json.loads(item) for item in chunk]
            if records:
                await supabase.table("event_photos").insert(records).execute()

        patch: dict = {
            "description": _metadata_to_description(
                {
                    **metadata,
                    "lastSyncedAt": _utcnow_iso(),
                    "imageCount": len(files),
                }
            ),
            "updated_at": _utcnow_iso(),
        }
        first_photo = photo_rows_by_drive_id.get(files[0].file_id) if files else None
        if first_photo:
            patch["cover_photo_id"] = first_photo["id"]
        await supabase.table("events").update(patch).eq("id", event_id).execute()

    return photo_rows_by_drive_id


async def _load_like_maps(
    supabase: AsyncClient,
    photo_ids: list[str],
    user: User | None,
) -> tuple[dict[str, int], set[str]]:
    if not photo_ids:
        return {}, set()

    like_counts: dict[str, int] = {}
    liked_ids: set[str] = set()
    for chunk in _chunked(photo_ids, 150):
        counts_resp = await (
            supabase.table("photo_like_counts")
            .select("photo_id, like_count")
            .in_("photo_id", chunk)
            .execute()
        )
        for row in rows(counts_resp):
            like_counts[str(row["photo_id"])] = int(row.get("like_count", 0) or 0)

    if user is not None:
        like_hash = _user_like_hash(user)
        for chunk in _chunked(photo_ids, 150):
            liked_resp = await (
                supabase.table("photo_likes")
                .select("photo_id")
                .eq("client_id_hash", like_hash)
                .in_("photo_id", chunk)
                .execute()
            )
            liked_ids.update(str(row["photo_id"]) for row in rows(liked_resp))

    return like_counts, liked_ids


async def _build_collection_from_row(
    supabase: AsyncClient,
    row: dict,
    user: User | None,
    *,
    include_all_images: bool,
) -> dict:
    base = _base_row_payload(row)
    try:
        files = await asyncio.to_thread(
            list_folder_images,
            base["driveFolderId"],
            recursive=base["recursive"],
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    photo_rows_by_drive_id = await _sync_section_assets(supabase, row, files)
    photo_ids = [
        str(photo_rows_by_drive_id[file.file_id]["id"])
        for file in files
        if file.file_id in photo_rows_by_drive_id
    ]
    like_counts, liked_ids = await _load_like_maps(supabase, photo_ids, user)

    all_images = []
    for index, file in enumerate(files):
        photo_row = photo_rows_by_drive_id.get(file.file_id)
        if not photo_row:
            continue
        photo_id = str(photo_row["id"])
        all_images.append(
            _make_photo_item(
                photo_row=photo_row,
                file=file,
                base=base,
                like_count=like_counts.get(photo_id, 0),
                liked=photo_id in liked_ids,
                is_featured=index < _COLLECTION_HIGHLIGHT_LIMIT,
            )
        )

    return {
        **base,
        "imageCount": len(all_images),
        "coverImage": all_images[0] if all_images else None,
        "previewImages": all_images[:_COLLECTION_PREVIEW_LIMIT],
        "highlightImages": all_images[:_COLLECTION_HIGHLIGHT_LIMIT],
        "images": all_images if include_all_images else [],
    }


async def list_admin_sections(supabase: AsyncClient) -> list[dict]:
    section_rows = await _load_gallery_rows(supabase, published_only=False)

    async def enrich(row: dict) -> dict:
        base = _base_row_payload(row)
        image_count, sample_images = await _inspect_folder(
            base["driveFolderId"],
            base["recursive"],
        )
        return {
            **base,
            "isPublished": bool(row.get("is_published", True)),
            "imageCount": image_count,
            "sampleImages": sample_images,
            "createdAt": row.get("created_at"),
            "updatedAt": row.get("updated_at"),
        }

    return await asyncio.gather(*(enrich(row) for row in section_rows))


async def create_admin_section(supabase: AsyncClient, payload: dict) -> dict:
    day_label = (payload.get("dayLabel") or "").strip()
    section_title = (payload.get("sectionTitle") or "").strip()
    drive_folder_url = (payload.get("driveFolderUrl") or "").strip()
    if not day_label or not section_title or not drive_folder_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="dayLabel, sectionTitle, and driveFolderUrl are required.",
        )

    drive_folder_id = parse_drive_folder_id(drive_folder_url)
    recursive = bool(payload.get("recursive", False))
    await _inspect_folder(drive_folder_id, recursive, limit=1)

    event_id = await _ensure_primary_event_exists(payload.get("eventId"))
    event_name = (payload.get("eventName") or "").strip() or None
    now = _utcnow_iso()
    slug_base = _slugify(f"{day_label}-{section_title}")
    unique_slug = f"{slug_base}-{uuid.uuid4().hex[:8]}"
    metadata = {
        "dayLabel": day_label,
        "eventId": event_id,
        "eventName": event_name,
        "recursive": recursive,
    }

    response = await (
        supabase.table("events")
        .insert({
            "slug": unique_slug,
            "name": section_title,
            "normalized_name": section_title.strip().lower(),
            "description": _metadata_to_description(metadata),
            "sort_order": int(payload.get("sortOrder", 0) or 0),
            "is_published": bool(payload.get("isPublished", True)),
            "drive_folder_url": drive_folder_url,
            "created_at": now,
            "updated_at": now,
        })
        .execute()
    )
    row = first_row(response)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create Mirage section.",
        )
    items = await list_admin_sections(supabase)
    created_id = str(row["id"])
    return next(item for item in items if item["id"] == created_id)


async def update_admin_section(
    supabase: AsyncClient,
    section_id: str,
    payload: dict,
) -> dict:
    try:
        section_uuid = str(uuid.UUID(section_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Mirage section ID.",
        ) from exc

    response = await (
        supabase.table("events")
        .select("id, slug, name, description, sort_order, is_published, drive_folder_url, cover_photo_id, created_at, updated_at")
        .eq("id", section_uuid)
        .limit(1)
        .execute()
    )
    current_row = first_row(response)
    if current_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mirage section not found.",
        )

    metadata = _metadata_from_row(current_row)
    patch_data: dict = {}

    if "sectionTitle" in payload and payload["sectionTitle"] is not None:
        section_title = payload["sectionTitle"].strip()
        if not section_title:
            raise HTTPException(status_code=400, detail="sectionTitle cannot be empty.")
        patch_data["name"] = section_title
        patch_data["normalized_name"] = section_title.lower()

    if "sortOrder" in payload and payload["sortOrder"] is not None:
        patch_data["sort_order"] = int(payload["sortOrder"])
    if "isPublished" in payload and payload["isPublished"] is not None:
        patch_data["is_published"] = bool(payload["isPublished"])
    if "dayLabel" in payload and payload["dayLabel"] is not None:
        day_label = payload["dayLabel"].strip()
        if not day_label:
            raise HTTPException(status_code=400, detail="dayLabel cannot be empty.")
        metadata["dayLabel"] = day_label

    if "eventId" in payload:
        metadata["eventId"] = await _ensure_primary_event_exists(payload.get("eventId"))
    if "eventName" in payload:
        metadata["eventName"] = (payload.get("eventName") or "").strip() or None
    if "recursive" in payload and payload["recursive"] is not None:
        metadata["recursive"] = bool(payload["recursive"])

    if "driveFolderUrl" in payload and payload["driveFolderUrl"] is not None:
        drive_folder_url = payload["driveFolderUrl"].strip()
        if not drive_folder_url:
            raise HTTPException(status_code=400, detail="driveFolderUrl cannot be empty.")
        drive_folder_id = parse_drive_folder_id(drive_folder_url)
        await _inspect_folder(drive_folder_id, bool(metadata.get("recursive", False)), limit=1)
        patch_data["drive_folder_url"] = drive_folder_url
    elif "recursive" in payload and payload["recursive"] is not None:
        current_folder_id = parse_drive_folder_id(current_row.get("drive_folder_url") or "")
        await _inspect_folder(current_folder_id, bool(metadata.get("recursive", False)), limit=1)

    metadata.pop("lastSyncedAt", None)
    metadata.pop("imageCount", None)
    patch_data["description"] = _metadata_to_description(metadata)
    patch_data["updated_at"] = _utcnow_iso()

    await (
        supabase.table("events")
        .update(patch_data)
        .eq("id", section_uuid)
        .execute()
    )
    items = await list_admin_sections(supabase)
    return next(item for item in items if item["id"] == section_uuid)


async def delete_admin_section(supabase: AsyncClient, section_id: str) -> None:
    try:
        section_uuid = str(uuid.UUID(section_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Mirage section ID.",
        ) from exc

    response = await (
        supabase.table("events")
        .select("id")
        .eq("id", section_uuid)
        .limit(1)
        .execute()
    )
    if first_row(response) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mirage section not found.",
        )
    await supabase.table("event_photos").delete().eq("event_id", section_uuid).execute()
    await supabase.table("events").delete().eq("id", section_uuid).execute()


async def list_public_gallery(supabase: AsyncClient, user: User | None = None) -> list[dict]:
    section_rows = await _load_gallery_rows(supabase, published_only=True)
    sections = await asyncio.gather(
        *(_build_collection_from_row(supabase, row, user, include_all_images=True) for row in section_rows)
    )
    grouped: OrderedDict[str, list[dict]] = OrderedDict()
    for section in sections:
        grouped.setdefault(section["dayLabel"], []).append(
            {
                **section,
                "previewImages": section["images"][:_COLLECTION_PREVIEW_LIMIT],
                "highlightImages": section["images"][:_COLLECTION_HIGHLIGHT_LIMIT],
            }
        )

    return [
        {"dayLabel": day_label, "sections": items}
        for day_label, items in grouped.items()
    ]


async def get_overview_payload(supabase: AsyncClient, user: User) -> dict:
    section_rows = await _load_gallery_rows(supabase, published_only=True)
    collections = await asyncio.gather(
        *(_build_collection_from_row(supabase, row, user, include_all_images=False) for row in section_rows)
    )

    collections.sort(key=lambda item: (item["sortOrder"], item["sectionTitle"].lower()))
    total_photos = sum(item["imageCount"] for item in collections)
    highlights: list[dict] = []
    grouped: OrderedDict[str, list[dict]] = OrderedDict()
    for collection in collections:
        grouped.setdefault(collection["dayLabel"], []).append(collection)
        for image in collection["highlightImages"]:
            if len(highlights) < _OVERVIEW_HIGHLIGHT_LIMIT:
                highlights.append(image)

    featured_collections = sorted(
        collections,
        key=lambda item: (-len(item["highlightImages"]), -item["imageCount"], item["sortOrder"]),
    )[:4]

    trending_rows_resp = await (
        supabase.table("trending_photos")
        .select("id, public_url, caption, like_count, trend_score")
        .limit(_TRENDING_LIMIT)
        .execute()
    )
    trending_rows = rows(trending_rows_resp)
    trending_photo_ids = [str(row["id"]) for row in trending_rows]
    like_counts, liked_ids = await _load_like_maps(supabase, trending_photo_ids, user)
    trending_photo_rows = await _load_photo_rows_by_ids(supabase, trending_photo_ids)
    trending_context = await _load_event_context_for_photo_ids(supabase, trending_photo_ids)

    photo_context_map: dict[str, dict] = {}
    for collection in collections:
        for image in collection["previewImages"] + collection["highlightImages"]:
            photo_context_map[image["photoId"]] = {
                "eventId": collection["eventId"],
                "eventName": collection["eventName"],
                "dayLabel": collection["dayLabel"],
            }

    trending = []
    for row in trending_rows:
        photo_id = str(row["id"])
        base = {
            **trending_context.get(photo_id, {}),
            **photo_context_map.get(photo_id, {}),
        }
        photo_row = trending_photo_rows.get(photo_id, row)
        drive_file_id = photo_row.get("drive_file_id")
        fake_file = (
            DriveImageFile(
                file_id=drive_file_id,
                name=(photo_row.get("caption") or row.get("caption") or drive_file_id or photo_id),
                mime_type="image/jpeg",
            )
            if drive_file_id
            else None
        )
        trending.append(
            _make_photo_item(
                photo_row={**row, **photo_row},
                file=fake_file,
                base=base,
                like_count=like_counts.get(photo_id, int(row.get("like_count", 0) or 0)),
                liked=photo_id in liked_ids,
                trend_score=int(row.get("trend_score", 0) or 0),
                is_featured=bool(base.get("isFeatured")) or photo_id in {item["photoId"] for item in highlights},
            )
        )

    return {
        "totalPhotos": total_photos,
        "totalCollections": len(collections),
        "dayLabels": list(grouped.keys()),
        "highlights": highlights,
        "trending": trending,
        "featuredCollections": featured_collections,
        "collectionsByDay": [
            {"dayLabel": day_label, "collections": items}
            for day_label, items in grouped.items()
        ],
    }


async def get_collection_detail(
    supabase: AsyncClient,
    collection_id: str,
    user: User,
) -> dict:
    try:
        collection_uuid = str(uuid.UUID(collection_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Mirage collection ID.",
        ) from exc

    response = await (
        supabase.table("events")
        .select("id, slug, name, description, sort_order, is_published, drive_folder_url, cover_photo_id, created_at, updated_at")
        .eq("id", collection_uuid)
        .eq("is_published", True)
        .limit(1)
        .execute()
    )
    row = first_row(response)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mirage collection not found.",
        )

    collection = await _build_collection_from_row(supabase, row, user, include_all_images=True)
    siblings_resp = await (
        supabase.table("events")
        .select("id, slug, name, description, sort_order, is_published, drive_folder_url, cover_photo_id, created_at, updated_at")
        .eq("is_published", True)
        .not_.is_("drive_folder_url", "null")
        .order("sort_order")
        .order("name")
        .execute()
    )
    siblings = rows(siblings_resp)
    related_rows = [item for item in siblings if str(item["id"]) != collection_uuid]
    related = await asyncio.gather(
        *(_build_collection_from_row(supabase, item, user, include_all_images=False) for item in related_rows[:4])
    )

    return {
        "collection": collection,
        "relatedCollections": related,
    }


async def toggle_photo_like(
    supabase: AsyncClient,
    photo_id: str,
    user: User,
) -> dict:
    try:
        photo_uuid = str(uuid.UUID(photo_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Mirage photo ID.",
        ) from exc

    client_hash = _user_like_hash(user)
    existing = await (
        supabase.table("photo_likes")
        .select("id")
        .eq("photo_id", photo_uuid)
        .eq("client_id_hash", client_hash)
        .limit(1)
        .execute()
    )
    row = first_row(existing)
    if row is not None:
        await (
            supabase.table("photo_likes")
            .delete()
            .eq("id", row["id"])
            .execute()
        )
        liked = False
    else:
        await (
            supabase.table("photo_likes")
            .insert({
                "photo_id": photo_uuid,
                "client_id_hash": client_hash,
            })
            .execute()
        )
        liked = True

    counts = await (
        supabase.table("photo_like_counts")
        .select("like_count")
        .eq("photo_id", photo_uuid)
        .limit(1)
        .execute()
    )
    count_row = first_row(counts) or {}
    return {
        "photoId": photo_uuid,
        "liked": liked,
        "likeCount": int(count_row.get("like_count", 0) or 0),
    }


async def get_drive_file_payload(
    file_id: str,
    *,
    fallback_name: str | None = None,
    fallback_mime_type: str | None = None,
) -> tuple[bytes, str, str]:
    from app.services.mirage_drive_service import download_file

    try:
        payload = await asyncio.to_thread(download_file, file_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    name = payload.name or fallback_name or file_id
    if (not payload.name or payload.name == file_id) and fallback_name:
        name = fallback_name
    mime_type = payload.mime_type
    if not mime_type or mime_type == "application/octet-stream":
        mime_type = fallback_mime_type or mime_type or "application/octet-stream"
    return payload.content, mime_type, name
