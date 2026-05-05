"""Health and readiness endpoints."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..repository import ProductRepository

router = APIRouter(tags=["health"])

_started_at = time.time()


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict:
    repo = ProductRepository(session)
    return {
        "status": "ok",
        "catalogSize": await repo.total(),
        "uptimeSeconds": round(time.time() - _started_at, 2),
    }


@router.get("/")
async def root() -> dict:
    return {
        "name": "granary-backend",
        "version": "0.1.0",
        "docs": "/docs",
    }
