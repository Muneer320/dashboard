import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.middleware import AccessControlMiddleware
from app.services.background_jobs import run_background_jobs_loop
from app.core.limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    if settings.BACKGROUND_JOB_INTERVAL_SECONDS > 0:
        app_instance.state.background_jobs_task = asyncio.create_task(
            run_background_jobs_loop())
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(httpx.RequestError)
async def httpx_request_error_handler(
    _: Request,
    exc: httpx.RequestError,
) -> JSONResponse:
    # Most commonly raised when PostgREST/Supabase is down or SUPABASE_URL is wrong.
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": (
                "Upstream REST dependency is unreachable (PostgREST/Supabase). "
                "Check SUPABASE_URL and the REST gateway. "
                f"Original error: {exc}"
            )
        },
    )

app.add_middleware(AccessControlMiddleware)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


def main():
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
    )


if __name__ == "__main__":
    main()
