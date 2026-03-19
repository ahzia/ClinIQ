from fastapi import FastAPI

from app.api.frontend_stub import router as frontend_stub_router
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.core.logging_setup import setup_logging
from app.core.request_middleware import request_context_middleware
from app.core.settings import settings

setup_logging()
app = FastAPI(title=settings.app_name, version=settings.app_version)
app.middleware("http")(request_context_middleware)
app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(ingest_router, prefix=settings.api_prefix)
app.include_router(frontend_stub_router, prefix=settings.api_prefix)
