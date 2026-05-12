from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client, create_client

from .config import Settings
from .normalize import normalize_identifier


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class MirageDatabase:
    def __init__(self, settings: Settings) -> None:
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    def upsert_event(
        self,
        slug: str,
        name: str | None = None,
        drive_folder_url: str | None = None,
    ) -> dict[str, Any]:
        event_name = name or slug.replace("-", " ").title()
        row: dict[str, Any] = {
            "slug": slug,
            "name": event_name,
            "normalized_name": normalize_identifier(event_name),
            "is_published": True,
            "updated_at": utc_now(),
        }
        if drive_folder_url is not None:
            row["drive_folder_url"] = drive_folder_url.strip() or None
        response = self.client.table("events").upsert(row, on_conflict="slug").execute()
        return response.data[0]

    def get_event(self, slug: str) -> dict[str, Any]:
        response = (
            self.client.table("events")
            .select("id, slug, name")
            .eq("slug", slug)
            .single()
            .execute()
        )
        return response.data

    def upsert_person(self, row: dict[str, str]) -> dict[str, Any]:
        display_name = row["display_name"].strip()
        alias = (row.get("alias") or "").strip() or None
        response = (
            self.client.table("people")
            .upsert(
                {
                    "display_name": display_name,
                    "normalized_name": normalize_identifier(display_name),
                    "alias": alias,
                    "normalized_alias": normalize_identifier(alias) if alias else None,
                    "is_published": True,
                    "updated_at": utc_now(),
                },
                on_conflict="normalized_name",
            )
            .execute()
        )
        return response.data[0]

    def unpublish_person(self, person_id: str) -> None:
        (
            self.client.table("people")
            .update({"is_published": False, "updated_at": utc_now()})
            .eq("id", person_id)
            .execute()
        )

    def find_person_by_name(self, display_name: str) -> dict[str, Any] | None:
        response = (
            self.client.table("people")
            .select("id, display_name")
            .eq("normalized_name", normalize_identifier(display_name))
            .maybe_single()
            .execute()
        )
        return response.data

    def upsert_photo(
        self,
        external_photo_id: str,
        public_url: str,
        storage_path: str | None = None,
        caption: str | None = None,
        drive_file_id: str | None = None,
    ) -> dict[str, Any]:
        row: dict[str, Any] = {
            "external_photo_id": external_photo_id,
            "storage_path": storage_path,
            "public_url": public_url,
            "caption": caption,
            "moderation_status": "approved",
            "is_published": True,
            "updated_at": utc_now(),
        }
        if drive_file_id is not None:
            row["drive_file_id"] = drive_file_id
        response = (
            self.client.table("photos")
            .upsert(row, on_conflict="external_photo_id")
            .execute()
        )
        return response.data[0]

    def link_photo_to_event(
        self,
        event_id: str,
        photo_id: str,
        sort_order: int = 0,
        is_featured: bool = False,
    ) -> None:
        (
            self.client.table("event_photos")
            .upsert(
                {
                    "event_id": event_id,
                    "photo_id": photo_id,
                    "sort_order": sort_order,
                    "is_featured": is_featured,
                },
                on_conflict="event_id,photo_id",
            )
            .execute()
        )

    def upsert_person_photo_match(
        self,
        person_id: str,
        photo_id: str,
        confidence: float,
        bbox: dict[str, float],
    ) -> None:
        (
            self.client.table("photo_people")
            .upsert(
                {
                    "person_id": person_id,
                    "photo_id": photo_id,
                    "confidence": confidence,
                    "bbox": bbox,
                    "source": "local_face_pipeline",
                    "review_status": "approved",
                    "updated_at": utc_now(),
                },
                on_conflict="person_id,photo_id",
            )
            .execute()
        )
