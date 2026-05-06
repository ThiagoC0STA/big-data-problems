"""FastAPI entry point for granary-backend."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .db import engine, session_factory
from .models import Base
from .repository import populate_if_empty
from .routers import enrich, health, lab, products, stats

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
log = logging.getLogger("granary")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info("ensuring schema…")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("schema ready")

    async def _seed():
        async with session_factory() as session:
            inserted = await populate_if_empty(
                session,
                count=settings.catalog_size,
                seed=settings.seed,
                defect_rate=settings.defect_rate,
            )
        if inserted:
            log.info("seeded %s products", inserted)
        else:
            log.info("catalog already populated, skipping seed")

    asyncio.create_task(_seed())
    log.info("backend ready (seeding in background)")
    try:
        yield
    finally:
        await engine.dispose()
        log.info("engine disposed")


app = FastAPI(
    title="Granary",
    version="0.1.0",
    description="Product data infrastructure backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Catalog-Size"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
    """Normalize HTTPException payloads into the ApiError shape."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        body = {**detail, "status": exc.status_code}
    else:
        body = {
            "code": f"http_{exc.status_code}",
            "message": str(detail) if detail else "Error",
            "retryable": exc.status_code in {408, 425, 429, 500, 502, 503, 504},
            "status": exc.status_code,
        }
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "message": "Request payload is invalid.",
            "retryable": False,
            "details": exc.errors(),
        },
    )


app.include_router(health.router)
app.include_router(products.router)
app.include_router(stats.router)
app.include_router(enrich.router)
app.include_router(lab.router)
