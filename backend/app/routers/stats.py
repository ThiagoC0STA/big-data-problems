"""Catalog stats — Postgres aggregations."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import ProductModel
from ..schemas import (
    BrandCount,
    CatalogStats,
    CategoryCount,
    InventoryHealth,
    IssueBreakdown,
    PriceBucket,
)

router = APIRouter(prefix="/stats", tags=["stats"])


_PRICE_BUCKETS: list[tuple[str, int, int]] = [
    ("Under $5", 0, 500),
    ("$5-$10", 500, 1000),
    ("$10-$20", 1000, 2000),
    ("$20-$50", 2000, 5000),
    ("$50+", 5000, 10**9),
]


@router.get("", response_model=CatalogStats)
async def get_stats(session: AsyncSession = Depends(get_session)) -> CatalogStats:
    total = int(
        (
            await session.execute(select(func.count()).select_from(ProductModel))
        ).scalar_one()
    )

    cat_q = (
        select(ProductModel.category, func.count())
        .group_by(ProductModel.category)
        .order_by(func.count().desc())
    )
    by_category = [
        CategoryCount(category=row[0], count=int(row[1]))
        for row in (await session.execute(cat_q)).all()
    ]

    val_q = select(ProductModel.validation_status, func.count()).group_by(
        ProductModel.validation_status
    )
    by_validation_raw = {
        row[0]: int(row[1]) for row in (await session.execute(val_q)).all()
    }
    by_validation = {
        "ok": by_validation_raw.get("ok", 0),
        "warning": by_validation_raw.get("warning", 0),
        "error": by_validation_raw.get("error", 0),
        "unreviewed": by_validation_raw.get("unreviewed", 0),
    }

    rev_q = select(ProductModel.review_status, func.count()).group_by(
        ProductModel.review_status
    )
    by_review_raw = {
        row[0]: int(row[1]) for row in (await session.execute(rev_q)).all()
    }
    by_review = {
        "unreviewed": by_review_raw.get("unreviewed", 0),
        "approved": by_review_raw.get("approved", 0),
        "rejected": by_review_raw.get("rejected", 0),
        "needs_changes": by_review_raw.get("needs_changes", 0),
    }

    price_buckets: list[PriceBucket] = []
    for label, lo, hi in _PRICE_BUCKETS:
        bq = (
            select(
                func.count(),
                func.min(ProductModel.price_cents),
                func.max(ProductModel.price_cents),
            )
            .where(ProductModel.price_cents > 0)
            .where(ProductModel.price_cents >= lo)
            .where(ProductModel.price_cents < hi)
        )
        row = (await session.execute(bq)).one()
        price_buckets.append(
            PriceBucket(
                bucket=label,
                count=int(row[0] or 0),
                min=int(row[1] or 0),
                max=int(row[2] or 0),
            )
        )

    brand_q = (
        select(ProductModel.brand, func.count())
        .where(ProductModel.brand != "")
        .group_by(ProductModel.brand)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_brands = [
        BrandCount(brand=row[0], count=int(row[1]))
        for row in (await session.execute(brand_q)).all()
    ]

    # Postgres-only: unnest the JSONB validation_issues array per row.
    issue_q = text(
        """
        SELECT issue->>'code' AS code, count(*) AS n
        FROM products, jsonb_array_elements(validation_issues) AS issue
        GROUP BY code
        ORDER BY n DESC
        """
    )
    issue_rows = (await session.execute(issue_q)).all()
    validation_issue_breakdown = [
        IssueBreakdown(code=row[0], count=int(row[1]))  # type: ignore[arg-type]
        for row in issue_rows
        if row[0]
    ]

    inv_q = select(
        func.sum(case((ProductModel.inventory >= 5, 1), else_=0)).label("healthy"),
        func.sum(
            case(
                (
                    (ProductModel.inventory > 0) & (ProductModel.inventory < 5),
                    1,
                ),
                else_=0,
            )
        ).label("low"),
        func.sum(case((ProductModel.inventory == 0, 1), else_=0)).label("out"),
    )
    inv_row = (await session.execute(inv_q)).one()
    inventory_health = InventoryHealth(
        healthy=int(inv_row[0] or 0),
        low=int(inv_row[1] or 0),
        out=int(inv_row[2] or 0),
    )

    return CatalogStats(
        total=total,
        by_category=by_category,
        by_validation=by_validation,
        by_review=by_review,
        price_buckets=price_buckets,
        top_brands=top_brands,
        validation_issue_breakdown=validation_issue_breakdown,
        inventory_health=inventory_health,
    )
