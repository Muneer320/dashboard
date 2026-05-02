from fastapi import APIRouter

from app.api.routes import (
    admin, admin_auth, admin_coins, admin_panel, announcements, auth, booth, coins, credentials,
    events, feedback, health, notifications, qr, questions, ratings, schedule, submissions, ugc, users,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(
    admin_auth.router, prefix="/auth/admin", tags=["admin-auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(
    submissions.router, prefix="/events", tags=["submissions"])
api_router.include_router(
    questions.router, prefix="/events", tags=["questions"])
api_router.include_router(
    ratings.router, prefix="/events", tags=["ratings"])
api_router.include_router(qr.router, prefix="/qr", tags=["qr"])
api_router.include_router(
    admin_panel.router, prefix="/admin-panel", tags=["admin-panel"])
api_router.include_router(
    schedule.router, prefix="/schedule", tags=["schedule"])
api_router.include_router(
    credentials.router, prefix="/credentials-requests", tags=["credentials"])
api_router.include_router(announcements.router,
                          prefix="/announcements", tags=["announcements"])
api_router.include_router(
    feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(coins.router, prefix="/coins", tags=["coins"])
api_router.include_router(ugc.router, prefix="/ugc", tags=["ugc"])
api_router.include_router(
    admin_coins.router, prefix="/admin", tags=["admin-coins"])
api_router.include_router(booth.router, prefix="/booth", tags=["booth"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"])
