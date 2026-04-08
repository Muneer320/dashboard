import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.middleware import AccessControlMiddleware
from app.services.background_jobs import run_background_jobs_loop


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    if settings.BACKGROUND_JOB_INTERVAL_SECONDS > 0:
        app_instance.state.background_jobs_task = asyncio.create_task(
            run_background_jobs_loop())
    try:
        yield
    finally:
        task = getattr(app_instance.state, "background_jobs_task", None)
        if task is not None:
            task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(AccessControlMiddleware)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
