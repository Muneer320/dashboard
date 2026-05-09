from __future__ import annotations

import asyncio
import hmac
import io
import tempfile
from pathlib import Path
import uuid
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from hashlib import sha256
from urllib.parse import quote

import asyncpg
from fastapi import HTTPException, UploadFile, status
from postgrest.exceptions import APIError
from supabase import AsyncClient

from app.core.config import settings
from app.db.mirage_postgres import mirage_connection
from app.db.supabase_client import first_row, rows
from app.models.admin import Admin
from app.models.user import User
from app.services.file_storage import (
    create_signed_file_url,
    delete_private_file,
    save_private_file,
)
from app.services.mirage_drive_service import (
    DriveImageFile,
    download_file,
    drive_file_view_url,
    list_folder_images,
    parse_drive_folder_id,
    parse_drive_file_id,
    public_drive_file_url,
)
from app.services.mirage_storage import (
    delete_mirage_image,
    mirage_public_url,
    save_mirage_image,
)

REQUIRED_ANCHOR_COUNT = settings.MIRAGE_REQUIRED_ANCHOR_COUNT
MAX_ANCHOR_COUNT = settings.MIRAGE_MAX_ANCHOR_COUNT
USER_IMAGE_PENDING_STATUSES = {"pending", "processing", "approved"}
USER_IMAGE_ACTIVE_STATUSES = {"pending", "processing", "approved", "rejected"}
JOB_TERMINAL_STATUSES = {"approved", "rejected", "failed"}


def _is_missing_mirage_table_error(error: Exception) -> bool:
    if isinstance(error, APIError):
        code = getattr(error, "code", None)
        message = str(getattr(error, "message", "") or error)
        return code == "PGRST205" and "mirage_" in message

    if isinstance(error, asyncpg.UndefinedTableError):
        return True

    sqlstate = getattr(error, "sqlstate", None)
    message = str(error)
    return sqlstate == "42P01" and "mirage_" in message


def _is_unconfigured_mirage_backend(error: Exception) -> bool:
    return isinstance(error, RuntimeError) and "MIRAGE_DATABASE_URL or DATABASE_URL" in str(error)


def _empty_mirage_profile(user_id: str) -> dict:
    return {
        "userId": user_id,
        "consentEnabled": False,
        "enrollmentStatus": "draft",
        "approvedAnchorCount": 0,
        "requiredAnchorCount": REQUIRED_ANCHOR_COUNT,
        "maxAnchorCount": MAX_ANCHOR_COUNT,
        "readyForSubmission": False,
        "images": [],
    }


def _row_dict(row) -> dict | None:
    if row is None:
        return None
    return dict(row)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_iso() -> str:
    return _utcnow().isoformat()


def _chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def _to_iso_or_none(value):
    if value is None or isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _ensure_uuid(value: str, *, detail: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc


def _drive_thumbnail_url(file_id: str, *, width: int = 1000) -> str:
    return f"https://drive.google.com/thumbnail?id={quote(file_id)}&sz=w{int(width)}"


def _photo_proxy_url(
    file_id: str,
    name: str,
    mime_type: str,
    *,
    width: int | None = None,
    quality: int = 82,
) -> str:
    signature, expires_at = build_drive_file_signature(
        file_id=file_id,
        name=name,
        mime_type=mime_type,
        width=width,
        quality=quality,
    )
    url = (
        f"{settings.API_V1_PREFIX}/mirage/files/{file_id}"
        f"?name={quote(name, safe='')}&mime={quote(mime_type, safe='')}"
        f"&exp={expires_at}&sig={signature}"
    )
    if width:
        url += f"&w={int(width)}&q={int(quality)}"
    return url


def _file_signature_payload(
    *,
    file_id: str,
    name: str,
    mime_type: str,
    width: int | None,
    quality: int,
    expires_at: int,
) -> str:
    return "|".join(
        [
            str(file_id),
            str(name),
            str(mime_type),
            str(width or ""),
            str(int(quality)),
            str(int(expires_at)),
        ]
    )


def build_drive_file_signature(
    *,
    file_id: str,
    name: str,
    mime_type: str,
    width: int | None,
    quality: int,
    expires_at: int | None = None,
) -> tuple[str, int]:
    expiry = int(expires_at or (_utcnow().timestamp() + 3600))
    payload = _file_signature_payload(
        file_id=file_id,
        name=name,
        mime_type=mime_type,
        width=width,
        quality=quality,
        expires_at=expiry,
    )
    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        sha256,
    ).hexdigest()
    return signature, expiry


def verify_drive_file_signature(
    *,
    file_id: str,
    name: str,
    mime_type: str,
    width: int | None,
    quality: int,
    expires_at: int,
    signature: str,
) -> bool:
    if int(expires_at) < int(_utcnow().timestamp()):
        return False
    expected, _ = build_drive_file_signature(
        file_id=file_id,
        name=name,
        mime_type=mime_type,
        width=width,
        quality=quality,
        expires_at=expires_at,
    )
    return hmac.compare_digest(str(signature), expected)


def _image_proxy_url(image_row: dict) -> str:
    drive_file_id = image_row.get("drive_file_id")
    if drive_file_id:
        return _photo_proxy_url(
            drive_file_id,
            str(image_row.get("filename") or drive_file_id),
            str(image_row.get("mime_type") or "image/jpeg"),
            width=1000,
            quality=82,
        )
    review_path = image_row.get("review_image_path")
    if review_path:
        try:
            return create_signed_file_url(review_path)
        except HTTPException:
            return ""
    return ""


def _matching_mode_display(mode: str) -> str:
    return mode or "high_precision"


_BROWSER_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"}
_PREVIEW_CONVERT_EXTENSIONS = {".tif", ".tiff", ".heic", ".heif", ".nef"}
_PREVIEW_CACHE_DIR = Path(tempfile.gettempdir()) / "ascent-mirage-previews"


def _largest_embedded_jpeg(content: bytes) -> bytes | None:
    largest: bytes | None = None
    start_at = 0
    while True:
        start = content.find(b"\xff\xd8\xff", start_at)
        if start < 0:
            break
        end = content.find(b"\xff\xd9", start + 3)
        if end < 0:
            break
        candidate = content[start : end + 2]
        if largest is None or len(candidate) > len(largest):
            largest = candidate
        start_at = start + 3
    return largest


def _convert_to_browser_preview(
    content: bytes,
    *,
    name: str,
    mime_type: str,
    max_width: int | None = None,
    quality: int = 92,
) -> tuple[bytes, str, str]:
    suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    normalized_mime = (mime_type or "").lower()
    if max_width is None and normalized_mime in _BROWSER_IMAGE_MIME_TYPES and suffix not in _PREVIEW_CONVERT_EXTENSIONS:
        return content, mime_type, name

    try:
        from PIL import Image, ImageOps

        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except Exception:
            pass

        image = None
        if suffix in {".tif", ".tiff"}:
            embedded_jpeg = _largest_embedded_jpeg(content)
            if embedded_jpeg:
                try:
                    image = Image.open(io.BytesIO(embedded_jpeg))
                except Exception:
                    image = None

        if suffix == ".nef":
            try:
                import rawpy

                with tempfile.NamedTemporaryFile(suffix=suffix) as temp_file:
                    temp_file.write(content)
                    temp_file.flush()
                    with rawpy.imread(temp_file.name) as raw:
                        rgb = raw.postprocess()
                image = Image.fromarray(rgb)
            except Exception:
                image = None

        if image is None:
            image = Image.open(io.BytesIO(content))

        image = ImageOps.exif_transpose(image).convert("RGB")
        if max_width and image.width > max_width:
            next_height = max(1, round(image.height * (max_width / image.width)))
            image = image.resize((max_width, next_height), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=max(1, min(95, int(quality))), optimize=True)
        base_name = name.rsplit(".", 1)[0] if "." in name else name
        return output.getvalue(), "image/jpeg", f"{base_name}.jpg"
    except Exception:
        return content, mime_type or "application/octet-stream", name


async def _ensure_primary_event_exists(supabase: AsyncClient, event_id: str | None) -> str | None:
    if not event_id:
        return None
    event_uuid = _ensure_uuid(event_id, detail="Invalid linked event ID.")
    response = await (
        supabase.table("events")
        .select("id, name")
        .eq("id", event_uuid)
        .limit(1)
        .execute()
    )
    row = first_row(response)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked event not found in the dashboard database.",
        )
    return event_uuid


async def _get_event_name(supabase: AsyncClient, event_id: str | None) -> str | None:
    if not event_id:
        return None
    response = await (
        supabase.table("events")
        .select("id, name")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    row = first_row(response)
    return row.get("name") if row else None


async def _ensure_user_profile(supabase: AsyncClient, user_id: str) -> dict:
    async with mirage_connection() as connection:
        row = await connection.fetchrow(
            """
            select user_id, consent_enabled, enrollment_status, approved_anchor_count,
                   last_embedding_version, last_processed_at
            from mirage_user_profiles
            where user_id = $1::uuid
            """,
            user_id,
        )
        if row is not None:
            return dict(row)

        created = await connection.fetchrow(
            """
            insert into mirage_user_profiles (
                user_id, consent_enabled, enrollment_status, approved_anchor_count,
                last_embedding_version, last_processed_at
            ) values ($1::uuid, false, 'draft', 0, 0, null)
            returning user_id, consent_enabled, enrollment_status, approved_anchor_count,
                      last_embedding_version, last_processed_at
            """,
            user_id,
        )
        return _row_dict(created) or {
            "user_id": user_id,
            "consent_enabled": False,
            "enrollment_status": "draft",
            "approved_anchor_count": 0,
            "last_embedding_version": 0,
            "last_processed_at": None,
        }


async def _load_user_images(supabase: AsyncClient, user_id: str) -> list[dict]:
    async with mirage_connection() as connection:
        result = await connection.fetch(
            """
            select id, user_id, storage_path, filename, status, quality_score,
                   rejection_reason, pose_label, created_at, updated_at
            from mirage_user_images
            where user_id = $1::uuid
            order by created_at
            """,
            user_id,
        )
    return [dict(row) for row in result]


async def _bump_profile_embedding_version(supabase: AsyncClient, user_id: str) -> None:
    profile = await _ensure_user_profile(supabase, user_id)
    next_version = int(profile.get("last_embedding_version") or 0) + 1
    async with mirage_connection() as connection:
        await connection.execute(
            """
            update mirage_user_profiles
            set last_embedding_version = $2, updated_at = now()
            where user_id = $1::uuid
            """,
            user_id,
            next_version,
        )


async def _reconcile_user_profile(supabase: AsyncClient, user_id: str) -> dict:
    profile = await _ensure_user_profile(supabase, user_id)
    images = await _load_user_images(supabase, user_id)
    active_images = [image for image in images if image.get("status") != "deleted"]
    approved_images = [image for image in active_images if image.get("status") == "approved"]
    consent_enabled = bool(profile.get("consent_enabled", False))

    if consent_enabled and len(approved_images) >= REQUIRED_ANCHOR_COUNT:
        enrollment_status = "ready"
    elif consent_enabled and len(active_images) >= REQUIRED_ANCHOR_COUNT:
        enrollment_status = "processing"
    elif len(active_images) == 0:
        enrollment_status = "draft"
    elif len(active_images) >= REQUIRED_ANCHOR_COUNT:
        enrollment_status = "draft"
    else:
        enrollment_status = "needs_more_images"

    async with mirage_connection() as connection:
        row = await connection.fetchrow(
            """
            update mirage_user_profiles
            set approved_anchor_count = $2,
                enrollment_status = $3,
                last_processed_at = $4,
                updated_at = now()
            where user_id = $1::uuid
            returning user_id, consent_enabled, enrollment_status, approved_anchor_count,
                      last_embedding_version, last_processed_at
            """,
            user_id,
            len(approved_images),
            enrollment_status,
            profile.get("last_processed_at"),
        )
    return _row_dict(row) or {
        **profile,
        "approved_anchor_count": len(approved_images),
        "enrollment_status": enrollment_status,
    }


def _serialize_anchor_image(image: dict) -> dict:
    preview_url = mirage_public_url(image.get("storage_path"))
    created_at = image.get("created_at")
    if created_at is not None and not isinstance(created_at, str):
        created_at = created_at.isoformat()
    return {
        "imageId": str(image["id"]),
        "filename": image.get("filename") or "",
        "status": image.get("status") or "pending",
        "poseLabel": image.get("pose_label"),
        "qualityScore": image.get("quality_score"),
        "rejectionReason": image.get("rejection_reason"),
        "previewUrl": preview_url,
        "createdAt": created_at,
    }


async def get_mirage_profile(supabase: AsyncClient, user: User) -> dict:
    user_id = str(user.id)
    try:
        profile = await _reconcile_user_profile(supabase, user_id)
        images = await _load_user_images(supabase, user_id)
        active_images = [image for image in images if image.get("status") != "deleted"]
        return {
            "userId": user_id,
            "consentEnabled": bool(profile.get("consent_enabled", False)),
            "enrollmentStatus": profile.get("enrollment_status") or "draft",
            "approvedAnchorCount": int(profile.get("approved_anchor_count") or 0),
            "requiredAnchorCount": REQUIRED_ANCHOR_COUNT,
            "maxAnchorCount": MAX_ANCHOR_COUNT,
            "readyForSubmission": len(active_images) >= REQUIRED_ANCHOR_COUNT,
            "images": [_serialize_anchor_image(image) for image in active_images],
        }
    except Exception as exc:
        if _is_missing_mirage_table_error(exc) or _is_unconfigured_mirage_backend(exc):
            return _empty_mirage_profile(user_id)
        raise


async def upload_mirage_anchor_image(
    supabase: AsyncClient,
    user: User,
    upload_file: UploadFile,
    pose_label: str | None,
) -> dict:
    user_id = str(user.id)
    try:
        await _ensure_user_profile(supabase, user_id)
        images = await _load_user_images(supabase, user_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mirage database is not configured yet.",
        ) from exc
    active_images = [image for image in images if image.get("status") != "deleted"]
    if len(active_images) >= MAX_ANCHOR_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can upload at most {MAX_ANCHOR_COUNT} Mirage anchor images.",
        )

    stored = await save_mirage_image(
        path_prefix=f"{settings.MIRAGE_STORAGE_PREFIX}/user-anchors/{user_id}",
        upload_file=upload_file,
    )
    async with mirage_connection() as connection:
        row = await connection.fetchrow(
            """
            insert into mirage_user_images (
                user_id, storage_path, filename, status, pose_label
            ) values ($1::uuid, $2, $3, 'pending', $4)
            returning id, user_id, storage_path, filename, status, quality_score,
                      rejection_reason, pose_label, created_at, updated_at
            """,
            user_id,
            stored.object_key,
            stored.filename,
            pose_label,
        )
    await _bump_profile_embedding_version(supabase, user_id)
    await _reconcile_user_profile(supabase, user_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save Mirage anchor image.",
        )
    return _serialize_anchor_image(dict(row))


async def delete_mirage_anchor_image(supabase: AsyncClient, user: User, image_id: str) -> None:
    user_id = str(user.id)
    image_uuid = _ensure_uuid(image_id, detail="Invalid Mirage image ID.")
    try:
        async with mirage_connection() as connection:
            row = await connection.fetchrow(
                """
                select id, user_id, storage_path
                from mirage_user_images
                where id = $1::uuid and user_id = $2::uuid
                """,
                image_uuid,
                user_id,
            )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mirage database is not configured yet.",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage image not found.")
    row = dict(row)

    storage_path = row.get("storage_path")
    if storage_path:
        try:
            delete_mirage_image(storage_path)
        except Exception:
            pass

    async with mirage_connection() as connection:
        await connection.execute(
            "delete from mirage_user_embeddings where user_image_id = $1::uuid",
            image_uuid,
        )
        await connection.execute(
            """
            update mirage_user_images
            set status = 'deleted', storage_path = null, updated_at = now()
            where id = $1::uuid
            """,
            image_uuid,
        )
    await _bump_profile_embedding_version(supabase, user_id)
    await _reconcile_user_profile(supabase, user_id)


async def submit_mirage_profile(
    supabase: AsyncClient,
    user: User,
    consent_enabled: bool,
) -> dict:
    user_id = str(user.id)
    try:
        await _ensure_user_profile(supabase, user_id)
        images = await _load_user_images(supabase, user_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mirage database is not configured yet.",
        ) from exc
    active_images = [image for image in images if image.get("status") != "deleted"]
    if len(active_images) < REQUIRED_ANCHOR_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Upload at least {REQUIRED_ANCHOR_COUNT} Mirage anchor images before submitting.",
        )
    async with mirage_connection() as connection:
        await connection.execute(
            """
            update mirage_user_profiles
            set consent_enabled = $2, updated_at = now()
            where user_id = $1::uuid
            """,
            user_id,
            bool(consent_enabled),
        )
    return await get_mirage_profile(supabase, user)


async def _load_like_maps(
    supabase: AsyncClient,
    photo_ids: list[str],
    user: User | None = None,
) -> tuple[dict[str, int], set[str]]:
    if not photo_ids:
        return {}, set()
    unique_photo_ids = list(dict.fromkeys(str(photo_id) for photo_id in photo_ids))
    counts: dict[str, int] = {photo_id: 0 for photo_id in unique_photo_ids}
    liked_ids: set[str] = set()

    for chunk in _chunked(unique_photo_ids, 150):
        response = await (
            supabase.table("mirage_photo_likes")
            .select("job_image_id, user_id")
            .in_("job_image_id", chunk)
            .execute()
        )
        for row in rows(response):
            photo_id = str(row.get("job_image_id"))
            counts[photo_id] = counts.get(photo_id, 0) + 1
            if user is not None and str(row.get("user_id")) == str(user.id):
                liked_ids.add(photo_id)
    return counts, liked_ids


async def _load_user_matched_image_ids(
    supabase: AsyncClient,
    image_ids: list[str],
    user: User | None,
) -> set[str]:
    if user is None or not image_ids:
        return set()
    matched_ids: set[str] = set()
    unique_image_ids = list(dict.fromkeys(str(image_id) for image_id in image_ids))
    for chunk in _chunked(unique_image_ids, 150):
        response = await (
            supabase.table("image_user_mappings")
            .select("image_id, user_id")
            .eq("user_id", str(user.id))
            .in_("image_id", chunk)
            .execute()
        )
        matched_ids.update(str(row["image_id"]) for row in rows(response))
    return matched_ids


def _trend_score_for_image(image: dict, like_count: int) -> int:
    created_at = image.get("created_at")
    recency_bonus = 0
    if created_at:
        try:
            created = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            recency_bonus = max(0, 14 - int((_utcnow() - created).days))
        except ValueError:
            recency_bonus = 0
    return like_count * 10 + recency_bonus


async def _serialize_job_image_for_photo(
    supabase: AsyncClient,
    job: dict,
    image: dict,
    user: User | None = None,
    like_counts: dict[str, int] | None = None,
    liked_ids: set[str] | None = None,
    trend_score: int | None = None,
    matched_image_ids: set[str] | None = None,
) -> dict:
    image_id = str(image["id"])
    if like_counts is None or liked_ids is None:
        like_counts, liked_ids = await _load_like_maps(supabase, [image_id], user)
    return {
        "photoId": image_id,
        "fileId": image.get("drive_file_id") or image_id,
        "name": image.get("filename") or image_id,
        "mimeType": "image/jpeg",
        "url": _image_proxy_url(image),
        "caption": image.get("filename"),
        "likeCount": like_counts.get(image_id, 0),
        "liked": image_id in liked_ids,
        "eventId": job.get("event_id"),
        "eventName": job.get("event_name_snapshot"),
        "dayLabel": job.get("day_label"),
        "jobId": str(job["id"]),
        "isFeatured": int(image.get("display_order", 0) or 0) < 3,
        "trendScore": trend_score,
        "matchedForCurrentUser": image_id in (matched_image_ids or set()),
    }


async def _load_live_job_images(supabase: AsyncClient, job_id: str) -> list[dict]:
    response = await (
        supabase.table("mirage_job_images")
        .select("*")
        .eq("job_id", job_id)
        .eq("status", "approved")
        .order("display_order")
        .execute()
    )
    return rows(response)


async def _build_collection_from_job(
    supabase: AsyncClient,
    job: dict,
    user: User | None,
    *,
    include_all_images: bool,
) -> dict:
    images = await _load_live_job_images(supabase, str(job["id"]))
    image_ids = [str(image["id"]) for image in images]
    like_counts, liked_ids = await _load_like_maps(supabase, image_ids, user)
    matched_image_ids = await _load_user_matched_image_ids(supabase, image_ids, user)
    sorted_images = sorted(
        images,
        key=lambda image: (
            0 if str(image["id"]) in matched_image_ids else 1,
            int(image.get("display_order") or 0),
            str(image.get("filename") or ""),
        ),
    )
    photo_items = [
        await _serialize_job_image_for_photo(
            supabase,
            job,
            image,
            user,
            like_counts,
            liked_ids,
            matched_image_ids=matched_image_ids,
        )
        for image in sorted_images
    ]
    preview = photo_items[:8]
    highlights = photo_items[:3]
    return {
        "id": str(job["id"]),
        "dayLabel": job.get("day_label") or "Highlights",
        "sectionTitle": job.get("event_name_snapshot") or "Mirage Event",
        "eventId": job.get("event_id"),
        "eventName": job.get("event_name_snapshot"),
        "driveFolderUrl": job.get("drive_folder_url") or "",
        "driveFolderId": job.get("drive_folder_id") or "",
        "recursive": bool(job.get("recursive", False)),
        "sortOrder": 0,
        "imageCount": len(photo_items),
        "coverImage": photo_items[0] if photo_items else None,
        "previewImages": preview,
        "highlightImages": highlights,
        "images": photo_items if include_all_images else preview,
    }


async def list_public_gallery(supabase: AsyncClient, user: User | None = None) -> list[dict]:
    try:
        jobs_response = await (
            supabase.table("mirage_jobs")
            .select("*")
            .eq("status", "live")
            .order("day_label")
            .order("created_at")
            .execute()
        )
        jobs = rows(jobs_response)
        collections = await asyncio.gather(
            *(_build_collection_from_job(supabase, job, user, include_all_images=True) for job in jobs)
        )
        grouped: OrderedDict[str, list[dict]] = OrderedDict()
        for collection in collections:
            grouped.setdefault(collection["dayLabel"], []).append(collection)
        return [{"dayLabel": day, "sections": sections} for day, sections in grouped.items()]
    except Exception as exc:
        if _is_missing_mirage_table_error(exc) or _is_unconfigured_mirage_backend(exc):
            return []
        raise


async def get_overview_payload(supabase: AsyncClient, user: User) -> dict:
    try:
        jobs_response = await (
            supabase.table("mirage_jobs")
            .select("*")
            .eq("status", "live")
            .order("day_label")
            .order("created_at")
            .execute()
        )
        jobs = rows(jobs_response)
        collections = await asyncio.gather(
            *(_build_collection_from_job(supabase, job, user, include_all_images=False) for job in jobs)
        )
        total_photos = sum(collection["imageCount"] for collection in collections)
        grouped: OrderedDict[str, list[dict]] = OrderedDict()
        highlights: list[dict] = []
        all_photos: list[dict] = []
        for collection in collections:
            grouped.setdefault(collection["dayLabel"], []).append(collection)
            highlights.extend(collection["highlightImages"][: max(0, 8 - len(highlights))])
            all_photos.extend(collection["previewImages"])

        trending = sorted(
            all_photos,
            key=lambda item: (
                1 if item.get("matchedForCurrentUser") else 0,
                item.get("likeCount", 0),
                item.get("name") or "",
            ),
            reverse=True,
        )[:12]
        featured_collections = sorted(
            collections,
            key=lambda item: (item["imageCount"], len(item["highlightImages"])),
            reverse=True,
        )[:4]
        return {
            "totalPhotos": total_photos,
            "totalCollections": len(collections),
            "dayLabels": list(grouped.keys()),
            "highlights": highlights[:8],
            "trending": trending,
            "featuredCollections": featured_collections,
            "collectionsByDay": [{"dayLabel": day, "collections": values} for day, values in grouped.items()],
        }
    except Exception as exc:
        if _is_missing_mirage_table_error(exc) or _is_unconfigured_mirage_backend(exc):
            return {
                "totalPhotos": 0,
                "totalCollections": 0,
                "dayLabels": [],
                "highlights": [],
                "trending": [],
                "featuredCollections": [],
                "collectionsByDay": [],
            }
        raise


async def get_collection_detail(supabase: AsyncClient, collection_id: str, user: User) -> dict:
    try:
        job_uuid = _ensure_uuid(collection_id, detail="Invalid Mirage collection ID.")
        response = await (
            supabase.table("mirage_jobs")
            .select("*")
            .eq("id", job_uuid)
            .eq("status", "live")
            .limit(1)
            .execute()
        )
        job = first_row(response)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage collection not found.")

        collection = await _build_collection_from_job(supabase, job, user, include_all_images=True)
        sibling_response = await (
            supabase.table("mirage_jobs")
            .select("*")
            .eq("status", "live")
            .neq("id", job_uuid)
            .order("created_at")
            .limit(4)
            .execute()
        )
        siblings = rows(sibling_response)
        related = await asyncio.gather(
            *(_build_collection_from_job(supabase, sibling, user, include_all_images=False) for sibling in siblings)
        )
        return {"collection": collection, "relatedCollections": related}
    except Exception as exc:
        if _is_missing_mirage_table_error(exc) or _is_unconfigured_mirage_backend(exc):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage collection not found.")
        raise


async def toggle_photo_like(supabase: AsyncClient, photo_id: str, user: User) -> dict:
    photo_uuid = _ensure_uuid(photo_id, detail="Invalid Mirage photo ID.")
    user_id = str(user.id)
    existing = await (
        supabase.table("mirage_photo_likes")
        .select("id")
        .eq("job_image_id", photo_uuid)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = first_row(existing)
    if row is not None:
        await supabase.table("mirage_photo_likes").delete().eq("id", row["id"]).execute()
        liked = False
    else:
        await (
            supabase.table("mirage_photo_likes")
            .insert({"job_image_id": photo_uuid, "user_id": user_id})
            .execute()
        )
        liked = True
    counts, _ = await _load_like_maps(supabase, [photo_uuid], user)
    return {"photoId": photo_uuid, "liked": liked, "likeCount": counts.get(photo_uuid, 0)}


async def get_drive_file_payload(
    file_id: str,
    *,
    fallback_name: str | None = None,
    fallback_mime_type: str | None = None,
    max_width: int | None = None,
    quality: int = 82,
) -> tuple[bytes, str, str]:
    try:
        payload = await asyncio.to_thread(download_file, file_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    name = payload.name if payload.name and payload.name != file_id else (fallback_name or payload.name or file_id)
    mime_type = payload.mime_type or fallback_mime_type or "application/octet-stream"
    if max_width:
        _PREVIEW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_key = sha256(
            f"{file_id}:{name}:{mime_type}:{len(payload.content)}:{max_width}:{quality}".encode("utf-8")
        ).hexdigest()
        cache_path = _PREVIEW_CACHE_DIR / f"{cache_key}.jpg"
        if cache_path.exists():
            return cache_path.read_bytes(), "image/jpeg", f"{name.rsplit('.', 1)[0]}.jpg"
        content, next_mime, next_name = await asyncio.to_thread(
            _convert_to_browser_preview,
            payload.content,
            name=name,
            mime_type=mime_type,
            max_width=max_width,
            quality=quality,
        )
        if next_mime == "image/jpeg":
            try:
                cache_path.write_bytes(content)
            except OSError:
                pass
        return content, next_mime, next_name
    return await asyncio.to_thread(
        _convert_to_browser_preview,
        payload.content,
        name=name,
        mime_type=mime_type,
    )


async def list_my_mirage_photos(supabase: AsyncClient, user: User) -> list[dict]:
    try:
        user_id = str(user.id)
        mapping_response = await (
            supabase.table("image_user_mappings")
            .select("image_id, user_id")
            .eq("user_id", user_id)
            .execute()
        )
        mapping_rows = rows(mapping_response)
        mapped_image_ids = [str(row["image_id"]) for row in mapping_rows]
        if mapped_image_ids:
            image_response = await (
                supabase.table("mirage_job_images")
                .select("*")
                .in_("id", mapped_image_ids)
                .eq("status", "approved")
                .execute()
            )
            image_rows = rows(image_response)
            job_ids = sorted({str(image["job_id"]) for image in image_rows})
            jobs_by_id: dict[str, dict] = {}
            if job_ids:
                jobs_response = await (
                    supabase.table("mirage_jobs")
                    .select("*")
                    .in_("id", job_ids)
                    .eq("status", "live")
                    .execute()
                )
                jobs_by_id = {str(job["id"]): job for job in rows(jobs_response)}

            photos: list[dict] = []
            image_ids = [str(image["id"]) for image in image_rows if str(image["job_id"]) in jobs_by_id]
            like_counts, liked_ids = await _load_like_maps(supabase, image_ids, user)
            for image in image_rows:
                job = jobs_by_id.get(str(image["job_id"]))
                if job is None:
                    continue
                trend_score = _trend_score_for_image(image, like_counts.get(str(image["id"]), 0))
                photos.append(
                    await _serialize_job_image_for_photo(
                        supabase,
                        job,
                        image,
                        user,
                        like_counts,
                        liked_ids,
                        trend_score=trend_score,
                    )
                )
            return photos

        match_response = await (
            supabase.table("mirage_face_matches")
            .select("id, face_id, user_id, auto_decision, review_decision")
            .eq("user_id", user_id)
            .in_("review_decision", ["approved"])
            .execute()
        )
        approved_matches = rows(match_response)
        face_ids = [str(row["face_id"]) for row in approved_matches]
        if not face_ids:
            auto_response = await (
                supabase.table("mirage_face_matches")
                .select("id, face_id, user_id, auto_decision, review_decision")
                .eq("user_id", user_id)
                .eq("auto_decision", "approved")
                .is_("review_decision", "null")
                .execute()
            )
            approved_matches = rows(auto_response)
            face_ids = [str(row["face_id"]) for row in approved_matches]
        if not face_ids:
            return []

        faces_response = await (
            supabase.table("mirage_detected_faces")
            .select("id, job_image_id")
            .in_("id", face_ids)
            .execute()
        )
        face_rows = rows(faces_response)
        image_ids = [str(face["job_image_id"]) for face in face_rows]
        if not image_ids:
            return []

        image_response = await (
            supabase.table("mirage_job_images")
            .select("*")
            .in_("id", image_ids)
            .eq("status", "approved")
            .execute()
        )
        image_rows = rows(image_response)
        job_ids = sorted({str(image["job_id"]) for image in image_rows})
        jobs_by_id: dict[str, dict] = {}
        if job_ids:
            jobs_response = await (
                supabase.table("mirage_jobs")
                .select("*")
                .in_("id", job_ids)
                .eq("status", "live")
                .execute()
            )
            jobs_by_id = {str(job["id"]): job for job in rows(jobs_response)}

        photos: list[dict] = []
        image_ids = [str(image["id"]) for image in image_rows if str(image["job_id"]) in jobs_by_id]
        like_counts, liked_ids = await _load_like_maps(supabase, image_ids, user)
        for image in image_rows:
            job = jobs_by_id.get(str(image["job_id"]))
            if job is None:
                continue
            trend_score = _trend_score_for_image(image, like_counts.get(str(image["id"]), 0))
            photos.append(
                await _serialize_job_image_for_photo(
                    supabase,
                    job,
                    image,
                    user,
                    like_counts,
                    liked_ids,
                    trend_score=trend_score,
                )
            )
        return photos
    except Exception as exc:
        if _is_missing_mirage_table_error(exc) or _is_unconfigured_mirage_backend(exc):
            return []
        raise


async def search_mirage_people(supabase: AsyncClient, user: User, query: str, limit: int = 8) -> dict:
    search = query.strip()
    if len(search) < 2:
        return {"query": search, "people": []}

    async with mirage_connection() as connection:
        user_rows = await connection.fetch(
            """
            select id::text as id,
                   username,
                   name,
                   coalesce(details->>'email', username) as email
            from users
            where lower(name) like lower($1)
               or lower(username) like lower($1)
               or lower(coalesce(details->>'email', '')) like lower($1)
               or id::text = $2
            order by lower(name), lower(username)
            limit $3
            """,
            f"%{search}%",
            search,
            max(1, min(limit, 20)),
        )
        people = [dict(row) for row in user_rows]
        if not people:
            return {"query": search, "people": []}

        user_ids = [person["id"] for person in people]
        mapping_rows = await connection.fetch(
            """
            select m.user_id::text as matched_user_id,
                   to_jsonb(i.*) as image,
                   to_jsonb(j.*) as job
            from image_user_mappings m
            join mirage_job_images i on i.id = m.image_id
            join mirage_jobs j on j.id = i.job_id
            where m.user_id = any($1::uuid[])
              and i.status = 'approved'
              and j.status = 'live'
            order by m.user_id, j.created_at desc nulls last, i.display_order, i.filename
            """,
            user_ids,
        )

    image_ids = [str(row["image"]["id"]) for row in mapping_rows]
    like_counts, liked_ids = await _load_like_maps(supabase, image_ids, user)
    current_user_matched_ids = await _load_user_matched_image_ids(supabase, image_ids, user)

    photos_by_user: dict[str, list[dict]] = {person["id"]: [] for person in people}
    for row in mapping_rows:
        matched_user_id = str(row["matched_user_id"])
        image = dict(row["image"])
        job = dict(row["job"])
        image_id = str(image["id"])
        photo = await _serialize_job_image_for_photo(
            supabase,
            job,
            image,
            user,
            like_counts,
            liked_ids,
            trend_score=_trend_score_for_image(image, like_counts.get(image_id, 0)),
            matched_image_ids=current_user_matched_ids,
        )
        photos_by_user.setdefault(matched_user_id, []).append(photo)

    results = []
    for person in people:
        photos = photos_by_user.get(person["id"], [])
        results.append(
            {
                "userId": person["id"],
                "name": person.get("name") or "Unknown user",
                "username": person.get("username"),
                "email": person.get("email"),
                "photoCount": len(photos),
                "photos": photos[:12],
            }
        )
    return {"query": search, "people": results}


async def _compute_job_counts(supabase: AsyncClient, job_id: str) -> dict:
    async with mirage_connection() as connection:
        result = await connection.fetch(
            """
            select id, status
            from mirage_job_images
            where job_id = $1::uuid
            """,
            job_id,
        )
        pair_result = await connection.fetch(
            """
            select status, count(*)::int as count
            from inference_user_image_status
            where job_id = $1::uuid
            group by status
            """,
            job_id,
        )
    image_rows = [dict(row) for row in result]
    counts = Counter((row.get("status") or "pending") for row in image_rows)
    pair_counts = {str(row["status"]): int(row["count"]) for row in pair_result}
    return {
        "imageCount": len(image_rows),
        "processedImageCount": counts.get("processed", 0) + counts.get("approved", 0) + counts.get("review_required", 0) + counts.get("rejected", 0) + counts.get("failed", 0),
        "approvedImageCount": counts.get("approved", 0),
        "reviewRequiredCount": counts.get("review_required", 0) + counts.get("rerun_requested", 0),
        "pendingImageCount": counts.get("pending", 0) + counts.get("processing", 0),
        "failedImageCount": counts.get("failed", 0),
        "pendingPairCount": pair_counts.get("pending", 0),
        "positivePairCount": pair_counts.get("positive", 0),
        "negativePairCount": pair_counts.get("negative", 0),
        "failedPairCount": pair_counts.get("failed", 0),
    }


async def _load_inference_user_ids(
    connection,
    *,
    model_version: str,
    preprocessing_version: str,
) -> list[str]:
    rows = await connection.fetch(
        """
        select distinct e.user_id
        from mirage_user_profiles p
        join mirage_user_embeddings e on e.user_id = p.user_id
        where p.consent_enabled = true
          and e.model_version = $1
          and e.preprocessing_version = $2
        order by e.user_id
        """,
        model_version,
        preprocessing_version,
    )
    return [str(row["user_id"]) for row in rows]


async def _initialize_inference_state_for_job(
    connection,
    *,
    job_id: str,
    event_id: str | None,
    model_version: str,
    preprocessing_version: str,
    force_recheck: bool,
) -> dict[str, int]:
    user_ids = await _load_inference_user_ids(
        connection,
        model_version=model_version,
        preprocessing_version=preprocessing_version,
    )
    image_rows = await connection.fetch(
        """
        select id, drive_file_id
        from mirage_job_images
        where job_id = $1::uuid
        order by display_order
        """,
        job_id,
    )

    existing_count = await connection.fetchval(
        """
        select count(*)::int
        from inference_user_image_status
        where job_id = $1::uuid
          and model_version = $2
          and preprocessing_version = $3
        """,
        job_id,
        model_version,
        preprocessing_version,
    )
    inserted_count = 0
    reset_count = 0
    for image in image_rows:
        for user_id in user_ids:
            result = await connection.execute(
                """
                insert into inference_user_image_status (
                    event_id, job_id, image_id, gdrive_file_id, user_id,
                    status, model_version, preprocessing_version
                ) values (
                    $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
                    'pending', $6, $7
                )
                on conflict (job_id, image_id, user_id, model_version, preprocessing_version)
                do nothing
                """,
                event_id,
                job_id,
                str(image["id"]),
                image.get("drive_file_id"),
                user_id,
                model_version,
                preprocessing_version,
            )
            if result.endswith(" 1"):
                inserted_count += 1

    if force_recheck:
        result = await connection.execute(
            """
            update inference_user_image_status
            set status = 'pending',
                best_score = null,
                matched_face_index = null,
                matched_anchor_id = null,
                reason = 'force_recheck',
                last_inferred_at = null,
                updated_at = now()
            where job_id = $1::uuid
              and model_version = $2
              and preprocessing_version = $3
              and status in ('positive', 'negative', 'failed')
            """,
            job_id,
            model_version,
            preprocessing_version,
        )
        reset_count = int(result.rsplit(" ", 1)[-1])

    return {
        "totalUsers": len(user_ids),
        "totalImages": len(image_rows),
        "existingStatuses": int(existing_count or 0),
        "newPendingStatuses": inserted_count,
        "resetPendingStatuses": reset_count,
    }


async def _serialize_job_list_item(supabase: AsyncClient, job: dict) -> dict:
    counts = await _compute_job_counts(supabase, str(job["id"]))
    return {
        "jobId": str(job["id"]),
        "eventId": job.get("event_id"),
        "eventNameSnapshot": job.get("event_name_snapshot"),
        "dayLabel": job.get("day_label") or "Day 1",
        "driveFolderUrl": job.get("drive_folder_url") or "",
        "driveFolderId": job.get("drive_folder_id") or "",
        "matchingMode": _matching_mode_display(job.get("matching_mode") or "high_precision"),
        "recursive": bool(job.get("recursive", False)),
        "status": job.get("status") or "pending",
        "liveAt": _to_iso_or_none(job.get("live_at")),
        "createdAt": _to_iso_or_none(job.get("created_at")),
        "updatedAt": _to_iso_or_none(job.get("updated_at")),
        **counts,
    }


async def list_mirage_jobs(supabase: AsyncClient) -> list[dict]:
    try:
        async with mirage_connection() as connection:
            result = await connection.fetch(
                """
                select id, event_id, event_name_snapshot, day_label, drive_folder_url,
                       drive_folder_id, matching_mode, recursive, status, live_at,
                       created_at, updated_at
                from mirage_jobs
                order by created_at desc
                """
            )
        jobs = [dict(row) for row in result]
        return await asyncio.gather(*(_serialize_job_list_item(supabase, job) for job in jobs))
    except Exception:
        return []


async def create_mirage_job(supabase: AsyncClient, payload: dict) -> dict:
    day_label = (payload.get("dayLabel") or "").strip()
    drive_folder_url = (payload.get("driveFolderUrl") or "").strip()
    if not day_label or not drive_folder_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="dayLabel and driveFolderUrl are required.",
        )
    drive_folder_id = parse_drive_folder_id(drive_folder_url)
    recursive = bool(payload.get("recursive", False))
    supplied_file_ids = []
    for value in [*(payload.get("driveFileIds") or []), *(payload.get("driveImageUrls") or [])]:
        try:
            supplied_file_ids.append(parse_drive_file_id(str(value)))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if supplied_file_ids:
        seen_file_ids: set[str] = set()
        files = []
        for index, file_id in enumerate(supplied_file_ids, start=1):
            if file_id in seen_file_ids:
                continue
            seen_file_ids.add(file_id)
            files.append(DriveImageFile(file_id=file_id, name=f"{file_id}.jpg", mime_type="image/jpeg"))
    else:
        try:
            files = await asyncio.to_thread(list_folder_images, drive_folder_id, recursive=recursive)
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    event_id = await _ensure_primary_event_exists(supabase, payload.get("eventId"))
    event_name_snapshot = (payload.get("eventNameSnapshot") or "").strip() or await _get_event_name(supabase, event_id)
    model_version = str(payload.get("modelVersion") or settings.MIRAGE_MODEL_VERSION)
    preprocessing_version = str(payload.get("preprocessingVersion") or settings.MIRAGE_PREPROCESSING_VERSION)
    force_recheck = bool(payload.get("forceRecheck", False))
    only_pending = bool(payload.get("onlyPending", True))

    try:
        async with mirage_connection() as connection:
            job = await connection.fetchrow(
                """
                insert into mirage_jobs (
                    event_id, event_name_snapshot, day_label, drive_folder_url,
                    drive_folder_id, recursive, matching_mode, status, stats_json, review_summary,
                    force_recheck, only_pending, user_scope, image_scope,
                    model_version, preprocessing_version, match_threshold
                ) values (
                    $1::uuid, $2, $3, $4, $5, $6, $7, 'pending', $8::jsonb, $9::jsonb,
                    $10, $11, $12, $13, $14, $15, $16
                )
                returning id, event_id, event_name_snapshot, day_label, drive_folder_url,
                          drive_folder_id, matching_mode, recursive, status, live_at,
                          created_at, updated_at
                """,
                event_id,
                event_name_snapshot,
                day_label,
                drive_folder_url,
                drive_folder_id,
                recursive,
                payload.get("matchingMode") or "high_precision",
                {"discoveredImageCount": len(files)},
                {},
                force_recheck,
                only_pending,
                payload.get("userScope") or "all",
                payload.get("imageScope") or "all",
                model_version,
                preprocessing_version,
                float(payload.get("threshold") or settings.MIRAGE_DEFAULT_THRESHOLD),
            )
            if job is None:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create Mirage job.")

            for index, file in enumerate(files):
                await connection.execute(
                    """
                    insert into mirage_job_images (
                        job_id, drive_file_id, filename, display_order, status,
                        gdrive_url, download_url, mime_type, download_status, face_detection_status
                    )
                    values ($1::uuid, $2, $3, $4, 'pending', $5, $6, $7, 'pending', 'pending')
                    on conflict (job_id, drive_file_id) do update
                    set filename = excluded.filename,
                        display_order = excluded.display_order,
                        gdrive_url = excluded.gdrive_url,
                        download_url = excluded.download_url,
                        mime_type = excluded.mime_type,
                        updated_at = now()
                    """,
                    str(job["id"]),
                    file.file_id,
                    file.name,
                    index,
                    drive_file_view_url(file.file_id),
                    public_drive_file_url(file.file_id),
                    file.mime_type,
                )
            state_stats = await _initialize_inference_state_for_job(
                connection,
                job_id=str(job["id"]),
                event_id=event_id,
                model_version=model_version,
                preprocessing_version=preprocessing_version,
                force_recheck=force_recheck,
            )
            await connection.execute(
                """
                update mirage_jobs
                set stats_json = stats_json || $2::jsonb,
                    updated_at = now()
                where id = $1::uuid
                """,
                str(job["id"]),
                {**state_stats, "discoveredImageCount": len(files)},
            )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mirage database is not configured yet.",
        ) from exc

    return await _serialize_job_list_item(supabase, dict(job))


async def _load_faces_for_images(supabase: AsyncClient, image_ids: list[str]) -> dict[str, list[dict]]:
    if not image_ids:
        return {}
    response = await (
        supabase.table("mirage_detected_faces")
        .select("*")
        .in_("job_image_id", image_ids)
        .order("created_at")
        .execute()
    )
    result: dict[str, list[dict]] = {}
    for row in rows(response):
        result.setdefault(str(row["job_image_id"]), []).append(row)
    return result


async def _load_match_rows_for_faces(supabase: AsyncClient, face_ids: list[str]) -> dict[str, list[dict]]:
    if not face_ids:
        return {}
    response = await (
        supabase.table("mirage_face_matches")
        .select("*")
        .in_("face_id", face_ids)
        .order("best_score", desc=True)
        .execute()
    )
    match_rows = rows(response)
    user_ids = sorted({str(row["user_id"]) for row in match_rows if row.get("user_id")})
    users_by_id: dict[str, dict] = {}
    if user_ids:
        user_response = await (
            supabase.table("users")
            .select("id, name")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {str(row["id"]): row for row in rows(user_response)}

    result: dict[str, list[dict]] = {}
    for row in match_rows:
        if row.get("user_id"):
            row["user_name"] = users_by_id.get(str(row["user_id"]), {}).get("name")
        result.setdefault(str(row["face_id"]), []).append(row)
    return result


def _effective_positive_match(match: dict) -> bool:
    if match.get("review_decision") in {"rejected", "unknown"}:
        return False
    if match.get("review_decision") == "approved" or match.get("auto_decision") == "approved":
        return True
    return float(match.get("best_score") or 0) >= float(settings.MIRAGE_DEFAULT_THRESHOLD)


async def get_mirage_job_detail(supabase: AsyncClient, job_id: str) -> dict:
    job_uuid = _ensure_uuid(job_id, detail="Invalid Mirage job ID.")
    response = await (
        supabase.table("mirage_jobs")
        .select("*")
        .eq("id", job_uuid)
        .limit(1)
        .execute()
    )
    job = first_row(response)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage job not found.")

    image_response = await (
        supabase.table("mirage_job_images")
        .select("*")
        .eq("job_id", job_uuid)
        .order("display_order")
        .execute()
    )
    image_rows = rows(image_response)
    image_ids = [str(image["id"]) for image in image_rows]
    faces_by_image = await _load_faces_for_images(supabase, image_ids)
    face_ids = [str(face["id"]) for faces in faces_by_image.values() for face in faces]
    matches_by_face = await _load_match_rows_for_faces(supabase, face_ids)

    images: list[dict] = []
    for image in image_rows:
        face_items: list[dict] = []
        for face in faces_by_image.get(str(image["id"]), []):
            landmarks = face.get("landmarks") or []
            positive_matches = [
                match
                for match in matches_by_face.get(str(face["id"]), [])
                if _effective_positive_match(match)
            ]
            face_items.append(
                {
                    "faceId": str(face["id"]),
                    "bbox": face.get("bbox") or {},
                    "landmarks": landmarks if isinstance(landmarks, list) else [],
                    "detectionScore": face.get("detection_score"),
                    "qualityScore": face.get("quality_score"),
                    "status": "matched" if positive_matches else "unknown",
                    "matches": [
                        {
                            "matchId": str(match["id"]),
                            "userId": match.get("user_id"),
                            "userName": match.get("user_name"),
                            "bestScore": match.get("best_score"),
                            "secondBestScore": None,
                            "margin": None,
                            "autoDecision": "approved",
                            "reviewDecision": "approved",
                            "reviewedAt": match.get("reviewed_at"),
                        }
                        for match in positive_matches
                    ],
                }
            )
        images.append(
            {
                "jobImageId": str(image["id"]),
                "fileId": image.get("drive_file_id"),
                "filename": image.get("filename") or "",
                "url": _image_proxy_url(image),
                "displayOrder": int(image.get("display_order") or 0),
                "status": image.get("status") or "pending",
                "rerunReason": image.get("rerun_reason"),
                "detectedFaces": face_items,
            }
        )

    counts = await _compute_job_counts(supabase, job_uuid)
    return {
        "jobId": job_uuid,
        "eventId": job.get("event_id"),
        "eventNameSnapshot": job.get("event_name_snapshot"),
        "dayLabel": job.get("day_label") or "Day 1",
        "driveFolderUrl": job.get("drive_folder_url") or "",
        "driveFolderId": job.get("drive_folder_id") or "",
        "matchingMode": _matching_mode_display(job.get("matching_mode") or "high_precision"),
        "recursive": bool(job.get("recursive", False)),
        "status": job.get("status") or "pending",
        "stats": job.get("stats_json") or {},
        "reviewSummary": job.get("review_summary") or {},
        "createdAt": _to_iso_or_none(job.get("created_at")),
        "updatedAt": _to_iso_or_none(job.get("updated_at")),
        "approvedAt": _to_iso_or_none(job.get("approved_at")),
        "liveAt": _to_iso_or_none(job.get("live_at")),
        "images": images,
        **counts,
    }


async def delete_mirage_job(supabase: AsyncClient, admin: Admin, job_id: str) -> None:
    job_uuid = _ensure_uuid(job_id, detail="Invalid Mirage job ID.")
    response = await (
        supabase.table("mirage_jobs")
        .select("id, status, event_name_snapshot")
        .eq("id", job_uuid)
        .limit(1)
        .execute()
    )
    job = first_row(response)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage job not found.")

    await (
        supabase.table("mirage_review_actions")
        .insert(
            {
                "job_id": job_uuid,
                "action_type": "job_deleted",
                "actor_admin_uid": admin.uid,
                "notes": f"Deleted Mirage job with status {job.get('status') or 'unknown'}.",
            }
        )
        .execute()
    )
    await supabase.table("mirage_jobs").delete().eq("id", job_uuid).execute()


async def _refresh_job_status(supabase: AsyncClient, job_id: str) -> None:
    response = await (
        supabase.table("mirage_job_images")
        .select("status")
        .eq("job_id", job_id)
        .execute()
    )
    statuses = [row.get("status") or "pending" for row in rows(response)]
    if not statuses:
        next_status = "pending"
    elif any(status_name == "rerun_requested" for status_name in statuses):
        next_status = "rerun_pending"
    elif any(status_name in {"pending", "processing"} for status_name in statuses):
        next_status = "processing"
    elif any(status_name == "review_required" for status_name in statuses):
        next_status = "review"
    elif all(status_name in JOB_TERMINAL_STATUSES for status_name in statuses):
        next_status = "review"
    else:
        next_status = "review"
    await supabase.table("mirage_jobs").update({"status": next_status}).eq("id", job_id).execute()


async def update_mirage_job_image_review(
    supabase: AsyncClient,
    admin: Admin,
    job_image_id: str,
    payload: dict,
) -> dict:
    image_uuid = _ensure_uuid(job_image_id, detail="Invalid Mirage job image ID.")
    response = await (
        supabase.table("mirage_job_images")
        .select("*")
        .eq("id", image_uuid)
        .limit(1)
        .execute()
    )
    image = first_row(response)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage job image not found.")

    patch = {"status": payload.get("status")}
    if payload.get("rerunReason") is not None:
        patch["rerun_reason"] = payload.get("rerunReason")
    updated = await (
        supabase.table("mirage_job_images")
        .update(patch)
        .eq("id", image_uuid)
        .execute()
    )
    await (
        supabase.table("mirage_review_actions")
        .insert(
            {
                "job_id": image.get("job_id"),
                "job_image_id": image_uuid,
                "action_type": payload.get("status"),
                "actor_admin_uid": admin.uid,
                "notes": payload.get("rerunReason"),
            }
        )
        .execute()
    )
    await _refresh_job_status(supabase, str(image["job_id"]))
    row = first_row(updated) or {**image, **patch}
    return {
        "jobImageId": image_uuid,
        "status": row.get("status") or payload.get("status"),
        "rerunReason": row.get("rerun_reason"),
    }


async def update_mirage_face_match_review(
    supabase: AsyncClient,
    admin: Admin,
    match_id: str,
    payload: dict,
) -> dict:
    match_uuid = _ensure_uuid(match_id, detail="Invalid Mirage match ID.")
    response = await (
        supabase.table("mirage_face_matches")
        .select("*")
        .eq("id", match_uuid)
        .limit(1)
        .execute()
    )
    match = first_row(response)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage face match not found.")
    face_response = await (
        supabase.table("mirage_detected_faces")
        .select("job_image_id")
        .eq("id", match.get("face_id"))
        .limit(1)
        .execute()
    )
    face_row = first_row(face_response)
    job_image_id = face_row.get("job_image_id") if face_row else None
    image_response = None
    job_id = None
    if job_image_id:
        image_response = await (
            supabase.table("mirage_job_images")
            .select("job_id")
            .eq("id", job_image_id)
            .limit(1)
            .execute()
        )
        image_row = first_row(image_response)
        job_id = image_row.get("job_id") if image_row else None

    await (
        supabase.table("mirage_face_matches")
        .update(
            {
                "review_decision": payload.get("reviewDecision"),
                "reviewed_by": admin.uid,
                "reviewed_at": _utcnow_iso(),
            }
        )
        .eq("id", match_uuid)
        .execute()
    )
    await (
        supabase.table("mirage_review_actions")
        .insert(
            {
                "job_id": job_id,
                "job_image_id": job_image_id,
                "face_id": match.get("face_id"),
                "face_match_id": match_uuid,
                "action_type": f"match_{payload.get('reviewDecision')}",
                "actor_admin_uid": admin.uid,
            }
        )
        .execute()
    )
    return {"matchId": match_uuid, "reviewDecision": payload.get("reviewDecision")}


async def approve_mirage_job(supabase: AsyncClient, job_id: str) -> dict:
    job_uuid = _ensure_uuid(job_id, detail="Invalid Mirage job ID.")
    job_response = await (
        supabase.table("mirage_jobs")
        .select("id, event_id")
        .eq("id", job_uuid)
        .limit(1)
        .execute()
    )
    job = first_row(job_response)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage job not found.")
    image_response = await (
        supabase.table("mirage_job_images")
        .select("*")
        .eq("job_id", job_uuid)
        .execute()
    )
    image_rows = rows(image_response)
    unresolved_images = [
        row for row in image_rows
        if (row.get("status") or "pending") in {"pending", "processing", "rerun_requested"}
    ]
    if unresolved_images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every image must be resolved before approving the Mirage job.",
        )
    pending_pairs = await (
        supabase.table("inference_user_image_status")
        .select("id")
        .eq("job_id", job_uuid)
        .in_("status", ["pending", "failed"])
        .limit(1)
        .execute()
    )
    if rows(pending_pairs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every user-image inference pair must be resolved before approving the Mirage job.",
        )

    image_ids = [str(row["id"]) for row in image_rows]
    if image_ids:
        face_response = await (
            supabase.table("mirage_detected_faces")
            .select("id, job_image_id")
            .in_("job_image_id", image_ids)
            .execute()
        )
        face_rows = rows(face_response)
        face_ids = [str(row["id"]) for row in face_rows]
        image_by_id = {str(row["id"]): row for row in image_rows}
        face_to_image = {str(row["id"]): str(row["job_image_id"]) for row in face_rows}
    else:
        face_ids = []
        image_by_id = {}
        face_to_image = {}
    if face_ids:
        match_response = await (
            supabase.table("mirage_face_matches")
            .select("*")
            .in_("face_id", face_ids)
            .execute()
        )
        mapping_payloads = []
        for match in rows(match_response):
            if not _effective_positive_match(match) or not match.get("user_id"):
                continue
            image_id = face_to_image.get(str(match["face_id"]))
            image = image_by_id.get(str(image_id)) if image_id else None
            if not image:
                continue
            drive_file_id = image.get("drive_file_id") or ""
            mapping_payloads.append(
                {
                    "event_id": job.get("event_id"),
                    "job_id": job_uuid,
                    "image_id": image_id,
                    "gdrive_file_id": drive_file_id,
                    "user_id": match.get("user_id"),
                    "gdrive_url": image.get("gdrive_url") or drive_file_view_url(drive_file_id),
                    "download_url": image.get("download_url") or public_drive_file_url(drive_file_id),
                    "best_score": match.get("best_score"),
                    "matched_face_index": None,
                    "matched_anchor_id": None,
                    "model_version": settings.MIRAGE_MODEL_VERSION,
                    "preprocessing_version": settings.MIRAGE_PREPROCESSING_VERSION,
                }
            )
        if mapping_payloads:
            await (
                supabase.table("image_user_mappings")
                .upsert(
                    mapping_payloads,
                    on_conflict="job_id,image_id,user_id,model_version,preprocessing_version",
                )
                .execute()
            )
        await (
            supabase.table("mirage_face_matches")
            .update({"review_decision": "approved"})
            .in_("face_id", face_ids)
            .gte("best_score", settings.MIRAGE_DEFAULT_THRESHOLD)
            .is_("review_decision", "null")
            .execute()
        )

    await (
        supabase.table("mirage_job_images")
        .update({"status": "approved"})
        .eq("job_id", job_uuid)
        .in_("status", ["processed", "approved"])
        .execute()
    )
    await (
        supabase.table("mirage_jobs")
        .update({"status": "approved", "approved_at": _utcnow_iso()})
        .eq("id", job_uuid)
        .execute()
    )
    return {"jobId": job_uuid, "status": "approved"}


async def publish_mirage_job(supabase: AsyncClient, job_id: str) -> dict:
    job_uuid = _ensure_uuid(job_id, detail="Invalid Mirage job ID.")
    response = await (
        supabase.table("mirage_jobs")
        .select("id, status")
        .eq("id", job_uuid)
        .limit(1)
        .execute()
    )
    job = first_row(response)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mirage job not found.")
    if job.get("status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved Mirage jobs can be published.",
        )
    await (
        supabase.table("mirage_jobs")
        .update({"status": "live", "live_at": _utcnow_iso()})
        .eq("id", job_uuid)
        .execute()
    )
    return {"jobId": job_uuid, "status": "live"}
