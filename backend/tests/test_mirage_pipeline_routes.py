from contextlib import asynccontextmanager
from copy import deepcopy
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError
from pydantic import ValidationError

from app.api.deps import get_admin_only, get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models.admin import Admin, AdminRole
from app.models.user import User
from app.schemas.mirage import MirageJobDetailResponse
from app.schemas import mirage as mirage_schemas
from app.services import mirage_pipeline_service
from app.services.mirage_pipeline_service import build_drive_file_signature


def _make_user(username: str = "mirage-user", *, is_attending: bool = False) -> User:
    return User(
        id=uuid4(),
        username=username,
        password_hash="hash",
        name="Mirage User",
        details={},
        events={},
        food={"meal1": False, "meal2": False, "meal3": False},
        is_attending=is_attending,
        is_profile_complete=True,
    )


def _make_admin() -> Admin:
    return Admin(
        uid=1,
        username="mirage-admin",
        name="Mirage Admin",
        password_hash="hash",
        mail="archived-e95ebd623f@example.invalid",
        role=AdminRole.ADMIN,
    )


def _user_token(user: User) -> str:
    return create_access_token(str(user.id), role="user")


def _admin_token() -> str:
    return create_access_token("admin:1", role="admin")


@pytest.fixture(autouse=True)
def disable_background_jobs():
    app.state.disable_rate_limit_checks = True
    app.dependency_overrides.clear()
    original = settings.BACKGROUND_JOB_INTERVAL_SECONDS
    original_database_url = settings.DATABASE_URL
    original_mirage_database_url = settings.MIRAGE_DATABASE_URL
    settings.BACKGROUND_JOB_INTERVAL_SECONDS = 0
    settings.DATABASE_URL = None
    settings.MIRAGE_DATABASE_URL = None
    yield
    settings.BACKGROUND_JOB_INTERVAL_SECONDS = original
    settings.DATABASE_URL = original_database_url
    settings.MIRAGE_DATABASE_URL = original_mirage_database_url
    app.dependency_overrides.clear()
    app.state.disable_rate_limit_checks = False


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_user_mirage_enrollment_routes(monkeypatch, client):
    from app.api.routes import users as users_routes

    current_user = _make_user(is_attending=True)
    app.dependency_overrides[get_current_user] = lambda: current_user

    async def fake_get_mirage_profile(*args, **kwargs):
        return {
            "userId": str(current_user.id),
            "consentEnabled": False,
            "enrollmentStatus": "draft",
            "approvedAnchorCount": 0,
            "requiredAnchorCount": 6,
            "maxAnchorCount": 10,
            "readyForSubmission": False,
            "images": [],
        }

    async def fake_upload_mirage_anchor_image(*args, **kwargs):
        return {
            "imageId": "img-1",
            "filename": "front.jpg",
            "status": "draft",
            "poseLabel": "front",
        }

    async def fake_delete_mirage_anchor_image(*args, **kwargs):
        return None

    async def fake_submit_mirage_profile(*args, **kwargs):
        return {
            "userId": str(current_user.id),
            "consentEnabled": True,
            "enrollmentStatus": "processing",
            "approvedAnchorCount": 6,
            "requiredAnchorCount": 6,
            "maxAnchorCount": 10,
            "readyForSubmission": True,
            "images": [],
        }

    monkeypatch.setattr(users_routes, "get_mirage_profile", fake_get_mirage_profile, raising=False)
    monkeypatch.setattr(users_routes, "upload_mirage_anchor_image", fake_upload_mirage_anchor_image, raising=False)
    monkeypatch.setattr(users_routes, "delete_mirage_anchor_image", fake_delete_mirage_anchor_image, raising=False)
    monkeypatch.setattr(users_routes, "submit_mirage_profile", fake_submit_mirage_profile, raising=False)

    headers = {"Authorization": f"Bearer {_user_token(current_user)}"}

    profile_response = client.get("/api/v1/users/me/mirage/profile", headers=headers)
    assert profile_response.status_code == 200
    assert profile_response.json()["enrollmentStatus"] == "draft"

    upload_response = client.post(
        "/api/v1/users/me/mirage/images",
        headers=headers,
        data={"poseLabel": "front"},
        files={"file": ("front.jpg", b"image-bytes", "image/jpeg")},
    )
    assert upload_response.status_code == 201
    assert upload_response.json()["imageId"] == "img-1"

    submit_response = client.post(
        "/api/v1/users/me/mirage/profile/submit",
        headers=headers,
        json={"consentEnabled": True},
    )
    assert submit_response.status_code == 200
    assert submit_response.json()["enrollmentStatus"] == "processing"

    delete_response = client.delete(
        "/api/v1/users/me/mirage/images/img-1",
        headers=headers,
    )
    assert delete_response.status_code == 204


def test_user_mirage_enrollment_requires_attendee(client):
    current_user = _make_user(is_attending=False)
    app.dependency_overrides[get_current_user] = lambda: current_user

    headers = {"Authorization": f"Bearer {_user_token(current_user)}"}

    profile_response = client.get("/api/v1/users/me/mirage/profile", headers=headers)
    assert profile_response.status_code == 403
    assert profile_response.json()["detail"] == "Mirage is only available for attendees."


def test_admin_mirage_job_routes(monkeypatch, client):
    from app.api.routes import admin_panel as admin_routes

    app.dependency_overrides[get_admin_only] = lambda: _make_admin()

    async def fake_list_mirage_jobs(*args, **kwargs):
        return [{
            "jobId": "job-1",
            "dayLabel": "Day 1",
            "eventNameSnapshot": "Freshers Day 2026",
            "driveFolderUrl": "https://drive.google.com/drive/folders/test-folder",
            "driveFolderId": "test-folder",
            "matchingMode": "high_precision",
            "status": "pending",
            "imageCount": 50,
            "reviewRequiredCount": 0,
        }]

    async def fake_create_mirage_job(*args, **kwargs):
        return {
            "jobId": "job-1",
            "dayLabel": "Day 1",
            "eventNameSnapshot": "Freshers Day 2026",
            "driveFolderUrl": "https://drive.google.com/drive/folders/test-folder",
            "driveFolderId": "test-folder",
            "matchingMode": "high_precision",
            "status": "pending",
            "imageCount": 50,
            "reviewRequiredCount": 0,
        }

    async def fake_get_mirage_job_detail(*args, **kwargs):
        return {
            "jobId": "job-1",
            "dayLabel": "Day 1",
            "eventNameSnapshot": "Freshers Day 2026",
            "driveFolderUrl": "https://drive.google.com/drive/folders/test-folder",
            "driveFolderId": "test-folder",
            "matchingMode": "high_precision",
            "status": "review",
            "imageCount": 50,
            "reviewRequiredCount": 2,
            "images": [],
        }

    async def fake_update_mirage_job_image_review(*args, **kwargs):
        return {
            "jobImageId": "image-1",
            "status": "rerun_requested",
            "rerunReason": "Poster false positive",
        }

    async def fake_update_mirage_face_match_review(*args, **kwargs):
        return {
            "matchId": "match-1",
            "reviewDecision": "approved",
        }

    async def fake_approve_mirage_job(*args, **kwargs):
        return {
            "jobId": "job-1",
            "status": "approved",
        }

    async def fake_publish_mirage_job(*args, **kwargs):
        return {
            "jobId": "job-1",
            "status": "live",
        }

    async def fake_delete_mirage_job(*args, **kwargs):
        return None

    monkeypatch.setattr(admin_routes, "list_mirage_jobs", fake_list_mirage_jobs, raising=False)
    monkeypatch.setattr(admin_routes, "create_mirage_job", fake_create_mirage_job, raising=False)
    monkeypatch.setattr(admin_routes, "get_mirage_job_detail", fake_get_mirage_job_detail, raising=False)
    monkeypatch.setattr(admin_routes, "update_mirage_job_image_review", fake_update_mirage_job_image_review, raising=False)
    monkeypatch.setattr(admin_routes, "update_mirage_face_match_review", fake_update_mirage_face_match_review, raising=False)
    monkeypatch.setattr(admin_routes, "approve_mirage_job", fake_approve_mirage_job, raising=False)
    monkeypatch.setattr(admin_routes, "publish_mirage_job", fake_publish_mirage_job, raising=False)
    monkeypatch.setattr(admin_routes, "delete_mirage_job", fake_delete_mirage_job, raising=False)

    headers = {"Authorization": f"Bearer {_admin_token()}"}

    list_response = client.get("/api/v1/admin-panel/mirage/jobs", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["jobId"] == "job-1"

    create_response = client.post(
        "/api/v1/admin-panel/mirage/jobs",
        headers=headers,
        json={
            "dayLabel": "Day 1",
            "eventId": None,
            "eventNameSnapshot": "Freshers Day 2026",
            "driveFolderUrl": "https://drive.google.com/drive/folders/test-folder",
            "recursive": True,
            "matchingMode": "high_precision",
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["status"] == "pending"

    detail_response = client.get("/api/v1/admin-panel/mirage/jobs/job-1", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "review"

    image_patch_response = client.patch(
        "/api/v1/admin-panel/mirage/job-images/image-1",
        headers=headers,
        json={"status": "rerun_requested", "rerunReason": "Poster false positive"},
    )
    assert image_patch_response.status_code == 200
    assert image_patch_response.json()["status"] == "rerun_requested"

    match_patch_response = client.patch(
        "/api/v1/admin-panel/mirage/matches/match-1",
        headers=headers,
        json={"reviewDecision": "approved"},
    )
    assert match_patch_response.status_code == 200
    assert match_patch_response.json()["reviewDecision"] == "approved"

    approve_response = client.post("/api/v1/admin-panel/mirage/jobs/job-1/approve", headers=headers)
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    publish_response = client.post("/api/v1/admin-panel/mirage/jobs/job-1/publish", headers=headers)
    assert publish_response.status_code == 200
    assert publish_response.json()["status"] == "live"

    delete_response = client.delete("/api/v1/admin-panel/mirage/jobs/job-1", headers=headers)
    assert delete_response.status_code == 204


def test_admin_mirage_user_verification_routes(monkeypatch, client):
    from app.api.routes import admin_panel as admin_routes

    app.dependency_overrides[get_admin_only] = lambda: _make_admin()

    async def fake_list_mirage_anchor_users(*args, **kwargs):
        return [{
            "userId": "user-1",
            "username": "pseudo-user",
            "name": "Pseudo User",
            "consentEnabled": True,
            "enrollmentStatus": "processing",
            "approvedAnchorCount": 2,
            "requiredAnchorCount": 6,
            "pendingAnchorCount": 2,
            "processingAnchorCount": 0,
            "rejectedAnchorCount": 0,
            "totalActiveImageCount": 4,
            "readyForMapping": False,
            "images": [{
                "imageId": "img-1",
                "filename": "front.jpg",
                "status": "pending",
                "poseLabel": "front",
                "previewUrl": "https://example.com/front.jpg",
            }],
        }]

    monkeypatch.setattr(admin_routes, "list_mirage_anchor_users", fake_list_mirage_anchor_users, raising=False)

    headers = {"Authorization": f"Bearer {_admin_token()}"}
    response = client.get("/api/v1/admin-panel/mirage/users?pending_only=true", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["userId"] == "user-1"
    assert payload[0]["pendingAnchorCount"] == 2
    assert payload[0]["images"][0]["status"] == "pending"


def test_mirage_me_photos_route(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    current_user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: current_user

    async def fake_list_my_mirage_photos(*args, **kwargs):
        return [{
            "photoId": "photo-1",
            "fileId": "drive-file-1",
            "name": "IMG_001.jpg",
            "mimeType": "image/jpeg",
            "url": "/api/v1/mirage/files/drive-file-1",
            "eventId": "event-1",
            "eventName": "Freshers Day 2026",
            "dayLabel": "Day 1",
            "jobId": "job-1",
            "liked": False,
            "likeCount": 0,
            "isFeatured": False,
        }]

    monkeypatch.setattr(mirage_routes, "list_my_mirage_photos", fake_list_my_mirage_photos, raising=False)

    headers = {"Authorization": f"Bearer {_user_token(current_user)}"}
    response = client.get("/api/v1/mirage/me/photos", headers=headers)
    assert response.status_code == 200
    assert response.json()[0]["photoId"] == "photo-1"


def test_mirage_file_route_requires_valid_signature(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    async def fake_get_drive_file_payload(*args, **kwargs):
        return b"image-bytes", "image/jpeg", "frame.jpg"

    monkeypatch.setattr(mirage_routes, "get_drive_file_payload", fake_get_drive_file_payload, raising=False)

    forbidden = client.get(
        "/api/v1/mirage/files/drive-file-1",
        params={"name": "frame.jpg", "mime": "image/jpeg", "exp": 1, "sig": "deadbeef" * 8},
    )
    assert forbidden.status_code == 403

    signature, expires_at = build_drive_file_signature(
        file_id="drive-file-1",
        name="frame.jpg",
        mime_type="image/jpeg",
        width=1000,
        quality=82,
    )
    allowed = client.get(
        "/api/v1/mirage/files/drive-file-1",
        params={
            "name": "frame.jpg",
            "mime": "image/jpeg",
            "w": 1000,
            "q": 82,
            "exp": expires_at,
            "sig": signature,
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["cache-control"].startswith("private")


def test_mirage_job_detail_schema_exposes_gallery_and_batch_state():
    payload = MirageJobDetailResponse(
        jobId="job-1",
        dayLabel="Day 1",
        driveFolderUrl="https://drive.google.com/drive/folders/demo",
        driveFolderId="demo",
        matchingMode="high_precision",
        status="live",
        galleryVisibility="live",
        batchState="matching_users",
        stagedMappingCount=3,
        publishedMappingCount=10,
        images=[{
            "jobImageId": "image-1",
            "filename": "frame.jpg",
            "url": "/api/v1/mirage/files/file-1",
            "status": "processed",
            "mappedUserCount": 2,
        }],
    )

    assert payload.galleryVisibility == "live"
    assert payload.batchState == "matching_users"
    assert payload.stagedMappingCount == 3
    assert payload.publishedMappingCount == 10
    assert payload.images[0].mappedUserCount == 2


@pytest.mark.parametrize(
    ("field_name", "field_value"),
    [
        ("title", ""),
        ("title", " "),
        ("title", "\t"),
    ],
)
def test_mirage_moment_create_rejects_blank_required_fields(field_name, field_value):
    payload = {
        "title": "Freshers Day Moments",
        "dayLabel": "Day 1",
    }
    payload[field_name] = field_value

    with pytest.raises(ValidationError) as exc_info:
        mirage_schemas.MirageMomentCreateRequest(**payload)

    assert field_name in str(exc_info.value)


def test_mirage_moment_patch_rejects_blank_day_label():
    with pytest.raises(ValidationError):
        mirage_schemas.MirageMomentPatchRequest(dayLabel="   ")


def test_mirage_moment_create_allows_optional_day_label():
    model = mirage_schemas.MirageMomentCreateRequest(title="Opening Night")
    assert model.dayLabel is None


@pytest.mark.asyncio
async def test_get_public_mirage_moment_returns_none_without_published():
    store = {
        "mirage_moments": [
            {
                "id": "00000000-0000-4000-8000-000000000000",
                "title": "Draft Moment",
                "subtitle": None,
                "day_label": "Day 0",
                "status": "draft",
                "published_at": None,
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T08:00:00Z",
                "updated_at": "2026-05-14T08:00:00Z",
            },
        ],
        "mirage_moment_images": [],
        "mirage_moment_image_users": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.get_public_mirage_moment(_FakeSupabase(store))
    assert payload is None


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, store: dict[str, list[dict]], table_name: str):
        self.store = store
        self.table_name = table_name
        self._action = "select"
        self._payload = None
        self._eq_filters: list[tuple[str, object]] = []
        self._neq_filters: list[tuple[str, object]] = []
        self._in_filters: list[tuple[str, list[object]]] = []
        self._orderings: list[tuple[str, bool]] = []
        self._limit: int | None = None

    def select(self, *_args, **_kwargs):
        self._action = "select"
        return self

    def eq(self, column: str, value):
        self._eq_filters.append((column, value))
        return self

    def neq(self, column: str, value):
        self._neq_filters.append((column, value))
        return self

    def in_(self, column: str, values):
        self._in_filters.append((column, list(values)))
        return self

    def order(self, column: str, desc: bool = False):
        self._orderings.append((column, desc))
        return self

    def limit(self, value: int):
        self._limit = value
        return self

    def insert(self, payload):
        self._action = "insert"
        self._payload = deepcopy(payload)
        return self

    def update(self, payload: dict):
        self._action = "update"
        self._payload = deepcopy(payload)
        return self

    def delete(self):
        self._action = "delete"
        return self

    def _matches(self, row: dict) -> bool:
        for column, value in self._eq_filters:
            if row.get(column) != value:
                return False
        for column, value in self._neq_filters:
            if row.get(column) == value:
                return False
        for column, values in self._in_filters:
            if row.get(column) not in values:
                return False
        return True

    async def execute(self):
        table = self.store.setdefault(self.table_name, [])
        matching = [row for row in table if self._matches(row)]

        if self._action == "select":
            result = deepcopy(matching)
            for column, desc in reversed(self._orderings):
                result.sort(key=lambda row: row.get(column), reverse=desc)
            if self._limit is not None:
                result = result[: self._limit]
            return _FakeResponse(result)

        if self._action == "insert":
            payload = self._payload
            items = payload if isinstance(payload, list) else [payload]
            table.extend(deepcopy(items))
            return _FakeResponse(deepcopy(items))

        if self._action == "update":
            updated: list[dict] = []
            for row in matching:
                row.update(deepcopy(self._payload))
                updated.append(deepcopy(row))
            return _FakeResponse(updated)

        if self._action == "delete":
            deleted = [deepcopy(row) for row in matching]
            self.store[self.table_name] = [row for row in table if not self._matches(row)]
            return _FakeResponse(deleted)

        raise AssertionError(f"Unsupported action: {self._action}")


class _FakeSupabase:
    def __init__(self, store: dict[str, list[dict]]):
        self.store = store

    def table(self, table_name: str) -> _FakeQuery:
        return _FakeQuery(self.store, table_name)


class _AlwaysMissingTableSupabase:
    def table(self, _table_name: str) -> "_AlwaysMissingTableQuery":
        return _AlwaysMissingTableQuery()


class _AlwaysMissingTableQuery:
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def neq(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def insert(self, *_args, **_kwargs):
        return self

    def update(self, *_args, **_kwargs):
        return self

    def delete(self, *_args, **_kwargs):
        return self

    async def execute(self):
        raise APIError(
            {
                "message": "Could not find the table 'public.mirage_moments' in the schema cache",
                "code": "PGRST205",
                "hint": None,
                "details": None,
            }
        )


@pytest.mark.asyncio
async def test_get_public_mirage_moment_returns_published_payload():
    published_moment_id = "11111111-1111-4111-8111-111111111111"
    published_image_id = "33333333-3333-4333-8333-333333333333"
    other_image_id = "44444444-4444-4444-8444-444444444444"
    participant_id = "55555555-5555-4555-8555-555555555555"
    store = {
        "mirage_moments": [
            {
                "id": "00000000-0000-4000-8000-000000000000",
                "title": "Draft Moment",
                "subtitle": None,
                "day_label": "Day 0",
                "status": "draft",
                "published_at": None,
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T08:00:00Z",
                "updated_at": "2026-05-14T08:00:00Z",
            },
            {
                "id": published_moment_id,
                "title": "Moment of the Day",
                "subtitle": "Freshers Day 2026",
                "day_label": "Day 1",
                "status": "published",
                "published_at": "2026-05-14T10:00:00Z",
                "created_by_admin_id": 1,
                "updated_by_admin_id": 2,
                "created_at": "2026-05-14T09:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            },
        ],
        "mirage_moment_images": [
            {
                "id": other_image_id,
                "moment_id": published_moment_id,
                "is_cover": False,
                "storage_path": "mirage/moments/day-1-1.jpg",
                "image_url": "https://cdn.example.com/day-1-1.jpg",
                "thumbnail_url": "https://cdn.example.com/day-1-1-thumb.jpg",
                "filename": "day-1-1.jpg",
                "mime_type": "image/jpeg",
                "slide_title": "Opening",
                "display_order": 1,
                "width": 1920,
                "height": 1080,
            },
            {
                "id": published_image_id,
                "moment_id": published_moment_id,
                "is_cover": True,
                "storage_path": "mirage/moments/day-1-cover.jpg",
                "image_url": "https://cdn.example.com/day-1-cover.jpg",
                "thumbnail_url": "https://cdn.example.com/day-1-cover-thumb.jpg",
                "filename": "day-1-cover.jpg",
                "mime_type": "image/jpeg",
                "slide_title": "Main Stage",
                "display_order": 2,
                "width": 1920,
                "height": 1080,
            },
        ],
        "mirage_moment_image_users": [
            {
                "id": "66666666-6666-4666-8666-666666666666",
                "moment_image_id": published_image_id,
                "user_id": participant_id,
            }
        ],
        "users": [
            {
                "id": participant_id,
                "name": "Asha",
                "username": "asha",
            }
        ],
    }

    payload = await mirage_pipeline_service.get_public_mirage_moment(_FakeSupabase(store))

    assert payload == {
        "momentId": published_moment_id,
        "title": "Moment of the Day",
        "subtitle": "Freshers Day 2026",
        "dayLabel": "Day 1",
        "status": "published",
        "publishedAt": "2026-05-14T10:00:00Z",
        "images": [
            {
                "imageId": other_image_id,
                "displayOrder": 1,
                "storagePath": "mirage/moments/day-1-1.jpg",
                "filename": "day-1-1.jpg",
                "mimeType": "image/jpeg",
                "isCover": False,
                "imageUrl": "https://cdn.example.com/day-1-1.jpg",
                "thumbnailUrl": "https://cdn.example.com/day-1-1-thumb.jpg",
                "slideTitle": "Opening",
                "width": 1920,
                "height": 1080,
                "participants": [],
            },
            {
                "imageId": published_image_id,
                "displayOrder": 2,
                "storagePath": "mirage/moments/day-1-cover.jpg",
                "filename": "day-1-cover.jpg",
                "mimeType": "image/jpeg",
                "isCover": True,
                "imageUrl": "https://cdn.example.com/day-1-cover.jpg",
                "thumbnailUrl": "https://cdn.example.com/day-1-cover-thumb.jpg",
                "slideTitle": "Main Stage",
                "width": 1920,
                "height": 1080,
                "participants": [
                    {
                        "userId": participant_id,
                        "name": "Asha",
                        "username": "asha",
                    }
                ],
            },
        ],
    }


@pytest.mark.asyncio
async def test_list_mirage_moments_returns_admin_payloads():
    latest_moment_id = "77777777-7777-4777-8777-777777777777"
    older_moment_id = "88888888-8888-4888-8888-000000000088"
    store = {
        "mirage_moments": [
            {
                "id": older_moment_id,
                "title": "Morning Moment",
                "subtitle": None,
                "day_label": "Day 1",
                "status": "draft",
                "published_at": None,
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T08:00:00Z",
                "updated_at": "2026-05-14T08:00:00Z",
            },
            {
                "id": latest_moment_id,
                "title": "Evening Moment",
                "subtitle": "Closing",
                "day_label": "Day 1",
                "status": "published",
                "published_at": "2026-05-14T11:00:00Z",
                "created_by_admin_id": 1,
                "updated_by_admin_id": 2,
                "created_at": "2026-05-14T09:00:00Z",
                "updated_at": "2026-05-14T11:00:00Z",
            },
        ],
        "mirage_moment_images": [
            {
                "id": "99999999-9999-4999-8999-000000000099",
                "moment_id": latest_moment_id,
                "is_cover": True,
                "storage_path": "mirage/moments/evening-cover.jpg",
                "image_url": None,
                "thumbnail_url": None,
                "filename": "evening-cover.jpg",
                "mime_type": "image/jpeg",
                "slide_title": None,
                "display_order": 1,
                "width": None,
                "height": None,
            }
        ],
        "mirage_moment_image_users": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.list_mirage_moments(_FakeSupabase(store))

    assert [item["momentId"] for item in payload] == [latest_moment_id, older_moment_id]
    assert payload[0]["createdByAdminId"] == 1
    assert payload[0]["updatedByAdminId"] == 2
    assert payload[0]["createdAt"] == "2026-05-14T09:00:00Z"
    assert payload[0]["updatedAt"] == "2026-05-14T11:00:00Z"
    assert payload[0]["images"][0]["isCover"] is True
    assert payload[1]["images"] == []


@pytest.mark.asyncio
async def test_create_mirage_moment_creates_draft_for_admin():
    admin = _make_admin()
    store = {
        "mirage_moments": [],
        "mirage_moment_images": [],
        "mirage_moment_image_users": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.create_mirage_moment(
        _FakeSupabase(store),
        admin,
        {
            "title": "  Evening Moment  ",
            "subtitle": "   ",
            "dayLabel": "  Day 1  ",
        },
    )

    assert payload["title"] == "Evening Moment"
    assert payload["subtitle"] is None
    assert payload["dayLabel"] == "Day 1"
    assert payload["status"] == "draft"
    assert payload["publishedAt"] is None
    assert payload["createdByAdminId"] == admin.uid
    assert payload["updatedByAdminId"] == admin.uid
    assert payload["images"] == []
    assert store["mirage_moments"][0]["status"] == "draft"
    assert store["mirage_moments"][0]["title"] == "Evening Moment"
    assert store["mirage_moments"][0]["day_label"] == "Day 1"


@pytest.mark.asyncio
async def test_publish_mirage_moment_unpublishes_existing_moment():
    admin = _make_admin()
    current_published_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    target_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    store = {
        "mirage_moments": [
            {
                "id": current_published_id,
                "title": "Morning Moment",
                "subtitle": None,
                "day_label": "Day 1",
                "status": "published",
                "published_at": "2026-05-14T09:00:00Z",
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T08:00:00Z",
                "updated_at": "2026-05-14T09:00:00Z",
            },
            {
                "id": target_id,
                "title": "Evening Moment",
                "subtitle": "Closing",
                "day_label": "Day 1",
                "status": "draft",
                "published_at": None,
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            },
        ],
        "mirage_moment_images": [],
        "mirage_moment_image_users": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.publish_mirage_moment(_FakeSupabase(store), admin, target_id)

    previous = next(item for item in store["mirage_moments"] if item["id"] == current_published_id)
    target = next(item for item in store["mirage_moments"] if item["id"] == target_id)

    assert previous["status"] == "unpublished"
    assert previous["published_at"] is None
    assert previous["updated_by_admin_id"] == admin.uid
    assert target["status"] == "published"
    assert target["published_at"] is not None
    assert target["updated_by_admin_id"] == admin.uid
    assert payload["momentId"] == target_id
    assert payload["status"] == "published"
    assert payload["publishedAt"] == target["published_at"]


@pytest.mark.asyncio
async def test_unpublish_mirage_moment_clears_publication_state():
    admin = _make_admin()
    target_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    store = {
        "mirage_moments": [
            {
                "id": target_id,
                "title": "Evening Moment",
                "subtitle": "Closing",
                "day_label": "Day 1",
                "status": "published",
                "published_at": "2026-05-14T11:00:00Z",
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T11:00:00Z",
            }
        ],
        "mirage_moment_images": [],
        "mirage_moment_image_users": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.unpublish_mirage_moment(_FakeSupabase(store), admin, target_id)

    assert store["mirage_moments"][0]["status"] == "unpublished"
    assert store["mirage_moments"][0]["published_at"] is None
    assert store["mirage_moments"][0]["updated_by_admin_id"] == admin.uid
    assert payload["momentId"] == target_id
    assert payload["status"] == "unpublished"
    assert payload["publishedAt"] is None


@pytest.mark.asyncio
async def test_unpublish_requires_published_moment():
    admin = _make_admin()
    target_id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    store = {
        "mirage_moments": [
            {
                "id": target_id,
                "title": "Draft Evening",
                "subtitle": None,
                "day_label": "Day 1",
                "status": "draft",
                "published_at": None,
                "created_by_admin_id": 1,
                "updated_by_admin_id": 1,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            },
        ],
        "mirage_moment_images": [],
        "mirage_moment_image_users": [],
        "users": [],
    }

    with pytest.raises(HTTPException) as exc:
        await mirage_pipeline_service.unpublish_mirage_moment(_FakeSupabase(store), admin, target_id)

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_mirage_moment_falls_back_to_postgres_when_supabase_table_missing(monkeypatch):
    admin = _make_admin()
    settings.DATABASE_URL = "postgres://fallback"
    settings.MIRAGE_DATABASE_URL = "postgres://fallback"

    class FakeConnection:
        async def fetchrow(self, query, *args):
            assert "INSERT INTO public.mirage_moments" in query
            return {
                "id": args[0],
                "title": args[1],
                "subtitle": args[2],
                "day_label": args[3],
                "status": args[4],
                "published_at": args[5],
                "created_by_admin_id": args[6],
                "updated_by_admin_id": args[7],
                "created_at": args[8],
                "updated_at": args[9],
            }

    @asynccontextmanager
    async def fake_mirage_connection():
        yield FakeConnection()

    monkeypatch.setattr(mirage_pipeline_service, "mirage_connection", fake_mirage_connection)

    payload = await mirage_pipeline_service.create_mirage_moment(
        _AlwaysMissingTableSupabase(),
        admin,
        {"title": "Moment fallback", "dayLabel": "Day 1"},
    )

    assert payload["title"] == "Moment fallback"
    assert payload["dayLabel"] == "Day 1"
    assert payload["status"] == "draft"


@pytest.mark.asyncio
async def test_refresh_mirage_search_person_builds_index_rows():
    user_id = "11111111-1111-4111-8111-111111111111"
    live_job_id = "22222222-2222-4222-8222-222222222222"
    hidden_job_id = "33333333-3333-4333-8333-333333333333"
    eligible_image_id = "44444444-4444-4444-8444-444444444444"
    hidden_image_id = "55555555-5555-4555-8555-555555555555"
    store = {
        "users": [
            {
                "id": user_id,
                "username": "asha",
                "name": "Asha Rao",
                "details": {"email": "asha@example.com"},
            }
        ],
        "image_user_mappings": [
            {
                "job_id": live_job_id,
                "image_id": eligible_image_id,
                "user_id": user_id,
                "publish_state": "published",
            },
            {
                "job_id": hidden_job_id,
                "image_id": hidden_image_id,
                "user_id": user_id,
                "publish_state": "staged",
            },
        ],
        "mirage_job_images": [
            {
                "id": eligible_image_id,
                "job_id": live_job_id,
                "status": "approved",
                "display_order": 3,
                "created_at": "2026-05-14T10:00:00Z",
            },
            {
                "id": hidden_image_id,
                "job_id": hidden_job_id,
                "status": "approved",
                "display_order": 1,
                "created_at": "2026-05-14T11:00:00Z",
            },
        ],
        "mirage_jobs": [
            {
                "id": live_job_id,
                "gallery_visibility": "live",
            },
            {
                "id": hidden_job_id,
                "gallery_visibility": "draft",
            },
        ],
        "mirage_search_people": [],
        "mirage_search_person_photos": [],
    }

    await mirage_pipeline_service.refresh_mirage_search_person(_FakeSupabase(store), user_id)

    assert len(store["mirage_search_people"]) == 1
    assert store["mirage_search_people"][0]["user_id"] == user_id
    assert store["mirage_search_people"][0]["photo_count"] == 1
    assert store["mirage_search_people"][0]["cover_photo_id"] == eligible_image_id
    assert store["mirage_search_people"][0]["search_text"] == f"{user_id} asha asha@example.com asha rao"

    assert store["mirage_search_person_photos"] == [
        {
            "user_id": user_id,
            "photo_id": eligible_image_id,
            "job_id": live_job_id,
            "day_label": None,
            "display_order": 3,
            "publish_state": "published",
            "gallery_visibility": "live",
            "created_at": store["mirage_search_person_photos"][0]["created_at"],
            "updated_at": store["mirage_search_person_photos"][0]["updated_at"],
        }
    ]


@pytest.mark.asyncio
async def test_refresh_mirage_search_person_deletes_empty_index_rows():
    user_id = "99999999-9999-4999-8999-000000000099"
    store = {
        "users": [
            {
                "id": user_id,
                "username": "orphan",
                "name": "Orphan User",
                "details": {"email": "orphan@example.com"},
            }
        ],
        "image_user_mappings": [],
        "mirage_job_images": [],
        "mirage_jobs": [],
        "mirage_search_people": [
            {
                "user_id": user_id,
                "email": "orphan@example.com",
                "username": "orphan",
                "name": "Orphan User",
                "photo_count": 2,
                "cover_photo_id": "cover-1",
                "latest_photo_at": "2026-05-14T10:00:00Z",
                "search_text": "orphan",
                "is_searchable": True,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            }
        ],
        "mirage_search_person_photos": [
            {
                "user_id": user_id,
                "photo_id": "cover-1",
                "job_id": "job-1",
                "day_label": "Day 1",
                "display_order": 0,
                "publish_state": "published",
                "gallery_visibility": "live",
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            }
        ],
    }

    await mirage_pipeline_service.refresh_mirage_search_person(_FakeSupabase(store), user_id)

    assert store["mirage_search_people"] == []
    assert store["mirage_search_person_photos"] == []


@pytest.mark.asyncio
async def test_search_mirage_people_reads_index_rows():
    current_user = _make_user(is_attending=True)
    user_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    cover_image_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    job_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    store = {
        "mirage_search_people": [
            {
                "user_id": user_id,
                "email": "asha@example.com",
                "username": "asha",
                "name": "Asha Rao",
                "photo_count": 4,
                "cover_photo_id": cover_image_id,
                "latest_photo_at": "2026-05-14T10:00:00Z",
                "search_text": "asha asha@example.com asha rao",
                "is_searchable": True,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            }
        ],
        "mirage_job_images": [
            {
                "id": cover_image_id,
                "job_id": job_id,
                "drive_file_id": "drive-cover",
                "filename": "cover.jpg",
                "mime_type": "image/jpeg",
                "status": "approved",
                "display_order": 0,
                "created_at": "2026-05-14T10:00:00Z",
            }
        ],
        "mirage_jobs": [
            {
                "id": job_id,
                "event_id": None,
                "event_name_snapshot": "Freshers Day",
                "day_label": "Day 1",
                "gallery_visibility": "live",
            }
        ],
        "mirage_likes": [],
        "image_user_mappings": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.search_mirage_people(_FakeSupabase(store), current_user, "asha")

    assert payload["query"] == "asha"
    assert payload["people"][0]["userId"] == user_id
    assert payload["people"][0]["photoCount"] == 4
    assert payload["people"][0]["coverPhoto"]["photoId"] == cover_image_id


@pytest.mark.asyncio
async def test_get_mirage_search_person_detail_returns_photos():
    current_user = _make_user(is_attending=True)
    target_user_id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    cover_image_id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    extra_image_id = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    job_id = "12121212-1212-4212-8212-121212121212"
    store = {
        "mirage_search_people": [
            {
                "user_id": target_user_id,
                "email": "target@example.com",
                "username": "target",
                "name": "Target User",
                "photo_count": 2,
                "cover_photo_id": cover_image_id,
                "latest_photo_at": "2026-05-14T10:00:00Z",
                "search_text": "target target@example.com target user",
                "is_searchable": True,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            }
        ],
        "mirage_search_person_photos": [
            {
                "user_id": target_user_id,
                "photo_id": cover_image_id,
                "job_id": job_id,
                "day_label": "Day 1",
                "display_order": 0,
                "publish_state": "published",
                "gallery_visibility": "live",
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            },
            {
                "user_id": target_user_id,
                "photo_id": extra_image_id,
                "job_id": job_id,
                "day_label": "Day 1",
                "display_order": 1,
                "publish_state": "published",
                "gallery_visibility": "live",
                "created_at": "2026-05-14T11:00:00Z",
                "updated_at": "2026-05-14T11:00:00Z",
            },
        ],
        "mirage_job_images": [
            {
                "id": cover_image_id,
                "job_id": job_id,
                "drive_file_id": "drive-cover",
                "filename": "cover.jpg",
                "mime_type": "image/jpeg",
                "status": "approved",
                "display_order": 0,
                "created_at": "2026-05-14T10:00:00Z",
            },
            {
                "id": extra_image_id,
                "job_id": job_id,
                "drive_file_id": "drive-extra",
                "filename": "extra.jpg",
                "mime_type": "image/jpeg",
                "status": "approved",
                "display_order": 1,
                "created_at": "2026-05-14T11:00:00Z",
            },
        ],
        "mirage_jobs": [
            {
                "id": job_id,
                "event_id": None,
                "event_name_snapshot": "Freshers Day",
                "day_label": "Day 1",
                "gallery_visibility": "live",
            }
        ],
        "mirage_likes": [],
        "image_user_mappings": [],
        "users": [],
    }

    payload = await mirage_pipeline_service.get_mirage_search_person_detail(
        _FakeSupabase(store),
        current_user,
        target_user_id,
    )

    assert payload["participant"]["userId"] == target_user_id
    assert payload["participant"]["coverPhoto"]["photoId"] == cover_image_id
    assert [photo["photoId"] for photo in payload["photos"]] == [cover_image_id, extra_image_id]


@pytest.mark.asyncio
async def test_public_gallery_queries_live_gallery_visibility(monkeypatch):
    eq_calls: list[tuple[str, object]] = []

    class _Query:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, column, value):
            eq_calls.append((column, value))
            return self

        def order(self, *_args, **_kwargs):
            return self

        async def execute(self):
            return type("_Response", (), {"data": [{"id": "job-1", "day_label": "Day 1"}]})()

    class _Supabase:
        def table(self, _name):
            return _Query()

    async def fake_build_collection_from_job(*_args, **_kwargs):
        return {"dayLabel": "Day 1", "images": []}

    monkeypatch.setattr(mirage_pipeline_service, "_build_collection_from_job", fake_build_collection_from_job)

    payload = await mirage_pipeline_service.list_public_gallery(_Supabase())

    assert payload == [{"dayLabel": "Day 1", "sections": [{"dayLabel": "Day 1", "images": []}]}]
    assert ("gallery_visibility", "live") in eq_calls
    assert ("status", "live") not in eq_calls


@pytest.mark.asyncio
async def test_job_list_item_uses_gallery_visibility_separate_from_batch_state(monkeypatch):
    async def fake_compute_job_counts(*_args, **_kwargs):
        return {
            "imageCount": 0,
            "processedImageCount": 0,
            "approvedImageCount": 0,
            "reviewRequiredCount": 0,
            "pendingImageCount": 0,
            "failedImageCount": 0,
            "pendingPairCount": 0,
            "positivePairCount": 0,
            "negativePairCount": 0,
            "failedPairCount": 0,
            "processedVerifiedUserCount": 0,
            "totalVerifiedUserCount": 0,
            "stagedMappingCount": 0,
            "publishedMappingCount": 0,
        }

    monkeypatch.setattr(mirage_pipeline_service, "_compute_job_counts", fake_compute_job_counts)

    item = await mirage_pipeline_service._serialize_job_list_item(
        None,
        {
            "id": "job-1",
            "day_label": "Day 1",
            "drive_folder_url": "https://drive.google.com/drive/folders/demo",
            "drive_folder_id": "demo",
            "matching_mode": "high_precision",
            "status": "processing",
            "gallery_visibility": "live",
            "batch_state": "matching_users",
        },
    )

    assert item["status"] == "live"
    assert item["galleryVisibility"] == "live"
    assert item["batchState"] == "matching_users"


def test_public_mirage_moment_route(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    async def fake_get_public_mirage_moment(supabase):
        assert supabase is not None
        return {
            "momentId": "moment-1",
            "title": "Moment of the Day",
            "subtitle": "Freshers Day 2026",
            "dayLabel": "Day 1",
            "status": "published",
            "publishedAt": "2026-05-14T10:00:00Z",
            "images": [],
        }

    monkeypatch.setattr(
        mirage_routes.mirage_pipeline_service,
        "get_public_mirage_moment",
        fake_get_public_mirage_moment,
        raising=False,
    )

    response = client.get("/api/v1/mirage/moment")
    assert response.status_code == 200
    assert response.json()["momentId"] == "moment-1"
    assert response.json()["status"] == "published"


def test_public_mirage_moment_returns_null_without_payload(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    async def fake_get_public_mirage_moment(supabase):
        assert supabase is not None
        return None

    monkeypatch.setattr(
        mirage_routes.mirage_pipeline_service,
        "get_public_mirage_moment",
        fake_get_public_mirage_moment,
        raising=False,
    )

    response = client.get("/api/v1/mirage/moment")
    assert response.status_code == 200
    assert response.json() is None


def test_public_mirage_moment_allows_anonymous_access(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    async def fake_get_public_mirage_moment(supabase):
        assert supabase is not None
        return {
            "momentId": "moment-auth-1",
            "title": "Anonymous Moment",
            "subtitle": None,
            "dayLabel": "Day 2",
            "status": "published",
            "publishedAt": "2026-05-14T11:00:00Z",
            "images": [],
        }

    monkeypatch.setattr(
        mirage_routes.mirage_pipeline_service,
        "get_public_mirage_moment",
        fake_get_public_mirage_moment,
        raising=False,
    )

    response = client.get("/api/v1/mirage/moment")
    assert response.status_code == 200
    assert response.json()["momentId"] == "moment-auth-1"


def test_mirage_search_routes_require_logged_in_user(client):
    response = client.get("/api/v1/mirage/search/people?q=asha")
    assert response.status_code == 401

    detail_response = client.get("/api/v1/mirage/search/people/user-1")
    assert detail_response.status_code == 401


def test_mirage_search_routes(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    current_user = _make_user(is_attending=True)
    app.dependency_overrides[get_current_user] = lambda: current_user

    async def fake_search_mirage_people(supabase, user, query, limit=8):
        assert user.id == current_user.id
        assert query == "asha"
        assert limit == 5
        return {
            "query": query,
            "people": [
                {
                    "userId": "user-1",
                    "name": "Asha Rao",
                    "username": "asha",
                    "email": "asha@example.com",
                    "photoCount": 3,
                    "coverPhoto": None,
                    "latestPhotoAt": "2026-05-14T10:00:00Z",
                }
            ],
        }

    async def fake_get_mirage_search_person_detail(supabase, user, user_id):
        assert user.id == current_user.id
        assert user_id == "user-1"
        return {
            "participant": {
                "userId": "user-1",
                "name": "Asha Rao",
                "username": "asha",
                "email": "asha@example.com",
                "photoCount": 3,
                "coverPhoto": None,
                "latestPhotoAt": "2026-05-14T10:00:00Z",
            },
            "photos": [],
        }

    monkeypatch.setattr(mirage_routes, "search_mirage_people", fake_search_mirage_people, raising=False)
    monkeypatch.setattr(
        mirage_routes,
        "get_mirage_search_person_detail",
        fake_get_mirage_search_person_detail,
        raising=False,
    )

    headers = {"Authorization": f"Bearer {_user_token(current_user)}"}

    search_response = client.get("/api/v1/mirage/search/people?q=asha&limit=5", headers=headers)
    assert search_response.status_code == 200
    assert search_response.json()["people"][0]["userId"] == "user-1"

    detail_response = client.get("/api/v1/mirage/search/people/user-1", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["participant"]["userId"] == "user-1"


def test_protected_mirage_route_rejects_anonymous_access(client):
    response = client.get("/api/v1/mirage/me/photos")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_admin_mirage_moment_route_rejects_anonymous_access(client):
    response = client.get("/api/v1/admin-panel/mirage/moments")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_admin_mirage_moment_routes(monkeypatch, client):
    from app.api.routes import admin_panel as admin_routes

    current_admin = _make_admin()
    app.dependency_overrides[get_admin_only] = lambda: current_admin

    list_calls: list[tuple[object]] = []
    create_calls: list[tuple[object, object, dict]] = []
    publish_calls: list[tuple[object, object, str]] = []
    unpublish_calls: list[tuple[object, object, str]] = []
    delete_calls: list[tuple[object, object, str]] = []

    async def fake_list_mirage_moments(supabase):
        list_calls.append((supabase,))
        return [{
            "momentId": "moment-1",
            "title": "Moment of the Day",
            "subtitle": "Freshers Day 2026",
            "dayLabel": "Day 1",
            "status": "draft",
            "publishedAt": None,
            "images": [],
            "createdByAdminId": 1,
            "updatedByAdminId": 1,
            "createdAt": "2026-05-14T09:00:00Z",
            "updatedAt": "2026-05-14T09:00:00Z",
        }]

    async def fake_create_mirage_moment(supabase, admin, payload):
        create_calls.append((supabase, admin, payload))
        assert admin == current_admin
        assert payload == {
            "title": "Evening Moment",
            "dayLabel": "Day 1",
        }
        return {
            "momentId": "moment-2",
            "title": "Evening Moment",
            "subtitle": None,
            "dayLabel": "Day 1",
            "status": "draft",
            "publishedAt": None,
            "images": [],
            "createdByAdminId": 1,
            "updatedByAdminId": 1,
            "createdAt": "2026-05-14T09:05:00Z",
            "updatedAt": "2026-05-14T09:05:00Z",
        }

    async def fake_publish_mirage_moment(supabase, admin, moment_id):
        publish_calls.append((supabase, admin, moment_id))
        assert admin == current_admin
        assert moment_id == "moment-2"
        return {
            "momentId": "moment-2",
            "title": "Evening Moment",
            "subtitle": None,
            "dayLabel": "Day 1",
            "status": "published",
            "publishedAt": "2026-05-14T10:05:00Z",
            "images": [],
            "createdByAdminId": 1,
            "updatedByAdminId": 1,
            "createdAt": "2026-05-14T09:05:00Z",
            "updatedAt": "2026-05-14T10:05:00Z",
        }

    async def fake_unpublish_mirage_moment(supabase, admin, moment_id):
        unpublish_calls.append((supabase, admin, moment_id))
        assert admin == current_admin
        assert moment_id == "moment-2"
        return {
            "momentId": "moment-2",
            "title": "Evening Moment",
            "subtitle": None,
            "dayLabel": "Day 1",
            "status": "unpublished",
            "publishedAt": None,
            "images": [],
            "createdByAdminId": 1,
            "updatedByAdminId": 1,
            "createdAt": "2026-05-14T09:05:00Z",
            "updatedAt": "2026-05-14T10:10:00Z",
        }

    async def fake_delete_mirage_moment(supabase, admin, moment_id):
        delete_calls.append((supabase, admin, moment_id))
        assert admin == current_admin
        assert moment_id == "moment-2"
        return None

    monkeypatch.setattr(
        admin_routes.mirage_pipeline_service,
        "list_mirage_moments",
        fake_list_mirage_moments,
        raising=False,
    )
    monkeypatch.setattr(
        admin_routes.mirage_pipeline_service,
        "create_mirage_moment",
        fake_create_mirage_moment,
        raising=False,
    )
    monkeypatch.setattr(
        admin_routes.mirage_pipeline_service,
        "publish_mirage_moment",
        fake_publish_mirage_moment,
        raising=False,
    )
    monkeypatch.setattr(
        admin_routes.mirage_pipeline_service,
        "unpublish_mirage_moment",
        fake_unpublish_mirage_moment,
        raising=False,
    )
    monkeypatch.setattr(
        admin_routes.mirage_pipeline_service,
        "delete_mirage_moment",
        fake_delete_mirage_moment,
        raising=False,
    )

    headers = {"Authorization": f"Bearer {_admin_token()}"}

    list_response = client.get("/api/v1/admin-panel/mirage/moments", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["momentId"] == "moment-1"
    assert len(list_calls) == 1

    create_response = client.post(
        "/api/v1/admin-panel/mirage/moments",
        headers=headers,
        json={
            "title": "Evening Moment",
            "dayLabel": "Day 1",
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["momentId"] == "moment-2"
    assert len(create_calls) == 1
    assert create_calls[0][1] == current_admin
    assert create_calls[0][2] == {
        "title": "Evening Moment",
        "dayLabel": "Day 1",
    }

    publish_response = client.post("/api/v1/admin-panel/mirage/moments/moment-2/publish", headers=headers)
    assert publish_response.status_code == 200
    assert publish_response.json()["status"] == "published"
    assert len(publish_calls) == 1
    assert publish_calls[0][1] == current_admin
    assert publish_calls[0][2] == "moment-2"

    unpublish_response = client.post("/api/v1/admin-panel/mirage/moments/moment-2/unpublish", headers=headers)
    assert unpublish_response.status_code == 200
    assert unpublish_response.json()["status"] == "unpublished"
    assert len(unpublish_calls) == 1
    assert unpublish_calls[0][1] == current_admin
    assert unpublish_calls[0][2] == "moment-2"

    delete_response = client.delete("/api/v1/admin-panel/mirage/moments/moment-2", headers=headers)
    assert delete_response.status_code == 204
    assert len(delete_calls) == 1
    assert delete_calls[0][1] == current_admin
    assert delete_calls[0][2] == "moment-2"


