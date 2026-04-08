from fastapi import APIRouter

from app.api.routes import auth, events, health, qr, submissions, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(
    submissions.router, prefix="/events", tags=["submissions"])
api_router.include_router(qr.router, prefix="/qr", tags=["qr"])
