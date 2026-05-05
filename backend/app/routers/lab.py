"""Resilience lab endpoints. Dedicated to *intentional* failures.

These power the /lab page on the frontend so the user can demonstrate that
boundary patterns actually contain failures.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..models import ProductModel
from ..repository import ProductRepository, populate_if_empty
from ..schemas import Product

router = APIRouter(prefix="/lab", tags=["lab"])


@router.get("/sample-products", response_model=list[Product])
async def sample_products(
    count: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[Product]:
    """Return a stable, deterministic sample for the lab's mini-table demo."""
    response = await ProductRepository(session).list(page=1, page_size=count)
    return response.rows


@router.post("/corrupt-row/{product_id}", response_model=Product)
async def corrupt_row(
    product_id: str,
    session: AsyncSession = Depends(get_session),
) -> Product:
    p = await ProductRepository(session).force_corrupt(product_id)
    if p is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": f"Product {product_id} not found.",
                "retryable": False,
            },
        )
    return p


@router.post("/corrupt-random", response_model=Product)
async def corrupt_random(
    session: AsyncSession = Depends(get_session),
) -> Product:
    """Corrupt a random product."""
    stmt = select(ProductModel.id).order_by(func.random()).limit(1)
    row = (await session.execute(stmt)).first()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "empty", "message": "Empty catalog.", "retryable": False},
        )
    p = await ProductRepository(session).force_corrupt(row[0])
    assert p is not None
    return p


@router.get("/500")
async def fail_500() -> dict:
    raise HTTPException(
        status_code=500,
        detail={
            "code": "lab_500",
            "message": "Simulated server error (the lab is doing its job).",
            "retryable": True,
        },
    )


@router.get("/4xx")
async def fail_400() -> dict:
    raise HTTPException(
        status_code=400,
        detail={
            "code": "lab_400",
            "message": "Simulated bad request.",
            "retryable": False,
        },
    )


@router.get("/timeout")
async def fail_timeout(seconds: float = Query(30.0, ge=0.0, le=60.0)) -> dict:
    """Long-blocking endpoint to test client-side timeouts."""
    await asyncio.sleep(seconds)
    return {"status": "ok", "slept": seconds}


@router.get("/slow")
async def slow(seconds: float = Query(2.5, ge=0.0, le=15.0)) -> dict:
    """Slow but ultimately successful response. Triggers stale-while-revalidate UX."""
    await asyncio.sleep(seconds)
    return {"status": "ok", "slept": seconds}


@router.post("/reset")
async def reset(session: AsyncSession = Depends(get_session)) -> dict:
    """Wipe the products table and reseed from scratch."""
    await session.execute(delete(ProductModel))
    await session.commit()
    inserted = await populate_if_empty(
        session,
        count=settings.catalog_size,
        seed=settings.seed,
        defect_rate=settings.defect_rate,
    )
    return {"status": "ok", "catalogSize": inserted}
