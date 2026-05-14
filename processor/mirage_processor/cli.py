from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Any

from .config import load_settings
from .database import MirageDatabase
from .drive import (
    download_drive_file_to_temp,
    drive_file_view_url,
    iter_image_files_in_folder,
    parse_drive_folder_id,
)
from .face import FaceEngine
from .index_store import EventIndexStore
from .matcher import accumulate_photo_matches
from .normalize import parse_bool, slugify_event

PEOPLE_COLUMNS = {"display_name", "alias", "anchor_filename", "consent"}
MANIFEST_COLUMNS = {"event_slug", "photo_id", "local_path", "public_url"}


def read_csv(path: Path, required_columns: set[str]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = required_columns - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f"{path} is missing column(s): {', '.join(sorted(missing))}")
        return [dict(row) for row in reader]


def parse_int(value: str | None, fallback: int = 0) -> int:
    if not value:
        return fallback
    return int(value)


def _suffix_for_mime(mime: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(mime, ".img")


def _process_one_photo(
    db: MirageDatabase,
    event: dict[str, Any],
    store: EventIndexStore,
    faces: FaceEngine,
    *,
    image_path: Path,
    external_photo_id: str,
    public_url: str,
    storage_path: str | None,
    drive_file_id: str | None,
    caption: str | None,
    sort_order: int,
    is_featured: bool,
    threshold: float,
    top_k: int,
    margin: float,
) -> tuple[int, int]:
    """Run face detection, Supabase photo upsert, event link, and person matches. Returns (face_count, match_count)."""
    photo = db.upsert_photo(
        external_photo_id=external_photo_id,
        public_url=public_url,
        storage_path=storage_path,
        caption=caption,
        drive_file_id=drive_file_id,
    )
    db.link_photo_to_event(
        event_id=event["id"],
        photo_id=photo["id"],
        sort_order=sort_order,
        is_featured=is_featured,
    )

    detected = faces.detect(image_path)
    stats_faces = len(detected)
    face_results: list[dict[str, Any]] = []

    for face in detected:
        embedding = faces.embedding(face)
        face_results.append(
            {
                "bbox": faces.bbox(face),
                "matches": store.search(embedding, k=top_k),
            }
        )

    best_by_person = accumulate_photo_matches(
        face_results,
        threshold=threshold,
        margin=margin,
    )

    stats_matches = 0
    for person_id, match in best_by_person.items():
        db.upsert_person_photo_match(
            person_id=person_id,
            photo_id=photo["id"],
            confidence=match["score"],
            bbox=match["bbox"],
        )
        stats_matches += 1

    return stats_faces, stats_matches


def enroll(args: argparse.Namespace) -> None:
    settings = load_settings()
    event_slug = slugify_event(args.event)
    db = MirageDatabase(settings)
    db.upsert_event(event_slug, args.event_name)
    store = EventIndexStore(settings.data_dir, event_slug)
    faces = FaceEngine(settings)

    rows = read_csv(Path(args.people), PEOPLE_COLUMNS)
    stats = {
        "rows": len(rows),
        "enrolled": 0,
        "skipped_no_consent": 0,
        "failed": 0,
    }

    for row in rows:
        if not parse_bool(row.get("consent")):
            stats["skipped_no_consent"] += 1
            continue

        anchor_path = Path(args.anchor_dir) / row["anchor_filename"]
        try:
            embedding = faces.require_single_embedding(anchor_path)
            person = db.upsert_person(row)
            anchor_key = row["anchor_filename"].strip()
            existing_label = store.label_for_anchor(person["id"], anchor_key)
            faiss_label = existing_label or store.next_faiss_label()
            store.upsert(
                person_id=person["id"],
                faiss_label=faiss_label,
                display_name=person["display_name"],
                embedding=embedding,
                anchor_key=anchor_key,
            )
            stats["enrolled"] += 1
            print(f"enrolled {person['display_name']} -> FAISS {faiss_label}")
        except Exception as error:  # noqa: BLE001 - continue batch and report all failures.
            stats["failed"] += 1
            print(f"failed {row.get('display_name', '<missing name>')}: {error}")

    store.save()
    print(f"enrollment complete: {stats}")


def process(args: argparse.Namespace) -> None:
    settings = load_settings()
    event_slug = slugify_event(args.event)
    threshold = float(args.threshold if args.threshold is not None else settings.default_threshold)
    manifest_path = Path(args.manifest)
    db = MirageDatabase(settings)
    event = db.upsert_event(event_slug, args.event_name)
    store = EventIndexStore(settings.data_dir, event_slug)
    faces = FaceEngine(settings)

    if len(store.labels) == 0:
        raise RuntimeError(f"No local FAISS labels exist for event {event_slug}. Run enroll first.")

    rows = read_csv(manifest_path, MANIFEST_COLUMNS)
    stats = {
        "rows": len(rows),
        "processed_photos": 0,
        "skipped_other_event": 0,
        "missing_files": 0,
        "faces": 0,
        "matches": 0,
        "failed": 0,
    }

    for index, row in enumerate(rows):
        if slugify_event(row["event_slug"]) != event_slug:
            stats["skipped_other_event"] += 1
            continue

        image_path = Path(row["local_path"])
        if not image_path.is_absolute():
            image_path = manifest_path.parent / image_path

        if not image_path.exists():
            stats["missing_files"] += 1
            print(f"missing file {image_path}")
            continue

        try:
            face_n, match_n = _process_one_photo(
                db,
                event,
                store,
                faces,
                image_path=image_path,
                external_photo_id=row["photo_id"].strip(),
                public_url=row["public_url"].strip(),
                storage_path=(row.get("storage_path") or "").strip() or None,
                drive_file_id=None,
                caption=(row.get("caption") or "").strip() or None,
                sort_order=parse_int(row.get("sort_order"), index),
                is_featured=parse_bool(row.get("is_featured")),
                threshold=threshold,
                top_k=settings.match_top_k,
                margin=settings.match_margin,
            )
            stats["faces"] += face_n
            stats["matches"] += match_n
            stats["processed_photos"] += 1
            print(f"processed {row['photo_id']} with {match_n} match(es)")
        except Exception as error:  # noqa: BLE001 - continue batch and report all failures.
            stats["failed"] += 1
            print(f"failed {row.get('photo_id', '<missing photo id>')}: {error}")

    print(f"processing complete: {stats}")


def process_drive(args: argparse.Namespace) -> None:
    settings = load_settings()
    cred_path = settings.google_application_credentials
    if cred_path is None or not cred_path.is_file():
        raise RuntimeError(
            "Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path. "
            "Enable the Google Drive API for that GCP project and share each photo folder "
            "with the service account email (Viewer is enough).",
        )

    event_slug = slugify_event(args.event)
    threshold = float(args.threshold if args.threshold is not None else settings.default_threshold)
    folder_id = parse_drive_folder_id(args.folder_url)
    db = MirageDatabase(settings)
    event = db.upsert_event(event_slug, args.event_name, drive_folder_url=args.folder_url.strip())
    store = EventIndexStore(settings.data_dir, event_slug)
    faces = FaceEngine(settings)

    if len(store.labels) == 0:
        raise RuntimeError(f"No local FAISS labels exist for event {event_slug}. Run enroll first.")

    stats = {
        "files_seen": 0,
        "processed_photos": 0,
        "faces": 0,
        "matches": 0,
        "failed": 0,
    }

    for index, drive_file in enumerate(
        iter_image_files_in_folder(
            cred_path,
            folder_id,
            recursive=bool(args.recursive),
        )
    ):
        stats["files_seen"] += 1
        suffix = _suffix_for_mime(drive_file.mime_type)
        tmp: Path | None = None
        try:
            tmp = download_drive_file_to_temp(cred_path, drive_file.file_id, suffix=suffix)
            ext_id = f"gdrive:{drive_file.file_id}"
            face_n, match_n = _process_one_photo(
                db,
                event,
                store,
                faces,
                image_path=tmp,
                external_photo_id=ext_id,
                public_url=drive_file_view_url(drive_file.file_id),
                storage_path=None,
                drive_file_id=drive_file.file_id,
                caption=drive_file.name,
                sort_order=index,
                is_featured=False,
                threshold=threshold,
                top_k=settings.match_top_k,
                margin=settings.match_margin,
            )
            stats["faces"] += face_n
            stats["matches"] += match_n
            stats["processed_photos"] += 1
            print(f"processed {ext_id} ({drive_file.name}) with {match_n} match(es)")
        except Exception as error:  # noqa: BLE001 - continue batch and report all failures.
            stats["failed"] += 1
            print(f"failed {drive_file.file_id} ({drive_file.name}): {error}")
        finally:
            if tmp is not None:
                tmp.unlink(missing_ok=True)

    print(f"drive processing complete: {stats}")


def remove_person(args: argparse.Namespace) -> None:
    settings = load_settings()
    event_slug = slugify_event(args.event)
    db = MirageDatabase(settings)
    person = db.find_person_by_name(args.name)

    if not person:
        print(f"No person found for {args.name}")
        return

    db.unpublish_person(person["id"])
    store = EventIndexStore(settings.data_dir, event_slug)
    removed = store.remove_person(person["id"])
    if removed:
        store.save()

    print(f"unpublished {person['display_name']} and rebuilt local FAISS index")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Mirage local face processing CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    enroll_parser = subparsers.add_parser("enroll", help="Enroll public person labels into FAISS")
    enroll_parser.add_argument("--event", required=True)
    enroll_parser.add_argument("--event-name")
    enroll_parser.add_argument("--people", required=True)
    enroll_parser.add_argument("--anchor-dir", required=True)
    enroll_parser.set_defaults(func=enroll)

    process_parser = subparsers.add_parser("process", help="Process event photo manifest")
    process_parser.add_argument("--event", required=True)
    process_parser.add_argument("--event-name")
    process_parser.add_argument("--manifest", required=True)
    process_parser.add_argument("--threshold", type=float)
    process_parser.set_defaults(func=process)

    drive_parser = subparsers.add_parser(
        "process-drive",
        help="List images in a Google Drive folder, download each, then run the same face pipeline as process",
    )
    drive_parser.add_argument("--event", required=True)
    drive_parser.add_argument("--event-name")
    drive_parser.add_argument(
        "--folder-url",
        required=True,
        help="Google Drive folder link or raw folder id (folder must be shared with the service account)",
    )
    drive_parser.add_argument(
        "--recursive",
        action="store_true",
        help="Also walk subfolders for images",
    )
    drive_parser.add_argument("--threshold", type=float)
    drive_parser.set_defaults(func=process_drive)

    remove_parser = subparsers.add_parser("remove-person", help="Unpublish a person and rebuild FAISS")
    remove_parser.add_argument("--event", required=True)
    remove_parser.add_argument("--name", required=True)
    remove_parser.set_defaults(func=remove_person)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
