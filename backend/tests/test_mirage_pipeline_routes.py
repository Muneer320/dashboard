from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_admin_only, get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models.admin import Admin, AdminRole
from app.models.user import User
from app.schemas.mirage import MirageJobDetailResponse
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
    settings.BACKGROUND_JOB_INTERVAL_SECONDS = 0
    yield
    settings.BACKGROUND_JOB_INTERVAL_SECONDS = original
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
            "anchorRevisionLivesRemaining": 3,
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
            "anchorRevisionLivesRemaining": 3,
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


def test_mirage_people_search_route(monkeypatch, client):
    from app.api.routes import mirage as mirage_routes

    current_user = _make_user(is_attending=True)
    app.dependency_overrides[get_current_user] = lambda: current_user

    async def fake_search(*args, **kwargs):
        return {"query": "ab", "people": []}

    monkeypatch.setattr(
        mirage_routes.mirage_pipeline_service,
        "search_mirage_people",
        fake_search,
    )

    headers = {"Authorization": f"Bearer {_user_token(current_user)}"}
    response = client.get("/api/v1/mirage/people/search?q=ab", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "ab"
    assert payload["people"] == []


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
