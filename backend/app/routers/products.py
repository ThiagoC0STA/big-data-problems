"""Product CRUD endpoints."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..repository import ProductRepository
from ..schemas import (
    BulkPatchRequest,
    BulkPatchResponse,
    EnrichmentStatus,
    Product,
    ProductFilter,
    ProductPatch,
    ProductSort,
    ProductsResponse,
    ReviewStatus,
    SortDirection,
    SortField,
    ValidationStatus,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductsResponse)
async def list_products(
    search: str | None = Query(None),
    category: str | None = Query(None),
    brand: str | None = Query(None),
    validationStatus: ValidationStatus | None = Query(None),  # noqa: N803
    enrichmentStatus: EnrichmentStatus | None = Query(None),  # noqa: N803
    reviewStatus: ReviewStatus | None = Query(None),  # noqa: N803
    priceMin: int | None = Query(None, ge=0),  # noqa: N803
    priceMax: int | None = Query(None, ge=0),  # noqa: N803
    sortField: SortField = Query("name"),  # noqa: N803
    sortDirection: SortDirection = Query("asc"),  # noqa: N803
    page: int = Query(1, ge=1),
    pageSize: int = Query(100, ge=1, le=1000),  # noqa: N803
    session: AsyncSession = Depends(get_session),
) -> ProductsResponse:
    f = ProductFilter(
        search=search,
        category=category,
        brand=brand,
        validation_status=validationStatus,
        enrichment_status=enrichmentStatus,
        review_status=reviewStatus,
        price_min=priceMin,
        price_max=priceMax,
    )
    s = ProductSort(field=sortField, direction=sortDirection)
    return await ProductRepository(session).list(filter=f, sort=s, page=page, page_size=pageSize)


@router.get("/meta/categories")
async def categories(session: AsyncSession = Depends(get_session)) -> list[str]:
    return await ProductRepository(session).categories()


@router.get("/meta/brands")
async def brands(session: AsyncSession = Depends(get_session)) -> list[str]:
    return await ProductRepository(session).brands()


@router.get("/{product_id}", response_model=Product)
async def get_product(
    product_id: str,
    session: AsyncSession = Depends(get_session),
) -> Product:
    p = await ProductRepository(session).get(product_id)
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


@router.patch("/{product_id}", response_model=Product)
async def patch_product(
    product_id: str,
    patch: ProductPatch,
    session: AsyncSession = Depends(get_session),
) -> Product:
    p = await ProductRepository(session).patch(product_id, patch)
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


@router.post("/bulk", response_model=BulkPatchResponse)
async def bulk_patch(
    request: BulkPatchRequest,
    session: AsyncSession = Depends(get_session),
) -> BulkPatchResponse:
    return await ProductRepository(session).bulk_patch(request)


_CSV_FIELDS = [
    "id",
    "sku",
    "name",
    "brand",
    "category",
    "subcategory",
    "description",
    "priceCents",
    "currency",
    "inventory",
    "barcode",
    "imageUrl",
    "weightG",
    "tags",
    "enrichmentStatus",
    "validationStatus",
    "reviewStatus",
    "createdAt",
    "updatedAt",
]


def _csv_iterator(rows: list[Product]) -> Iterator[str]:
    """Yield one CSV chunk at a time so we never materialise the full string."""
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(_CSV_FIELDS)
    yield buf.getvalue()
    buf.seek(0)
    buf.truncate(0)

    for p in rows:
        writer.writerow(
            [
                p.id,
                p.sku,
                p.name,
                p.brand,
                p.category,
                p.subcategory or "",
                p.description or "",
                p.price_cents,
                p.currency,
                p.inventory,
                p.barcode or "",
                p.image_url or "",
                p.weight_g if p.weight_g is not None else "",
                ";".join(p.tags),
                p.enrichment_status,
                p.validation_status,
                p.review_status,
                p.created_at,
                p.updated_at,
            ]
        )
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)


@router.get("/-/export")
async def export_products(
    search: str | None = Query(None),
    category: str | None = Query(None),
    brand: str | None = Query(None),
    validationStatus: ValidationStatus | None = Query(None),  # noqa: N803
    enrichmentStatus: EnrichmentStatus | None = Query(None),  # noqa: N803
    reviewStatus: ReviewStatus | None = Query(None),  # noqa: N803
    priceMin: int | None = Query(None, ge=0),  # noqa: N803
    priceMax: int | None = Query(None, ge=0),  # noqa: N803
    sortField: SortField = Query("name"),  # noqa: N803
    sortDirection: SortDirection = Query("asc"),  # noqa: N803
    limit: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """Stream the filtered catalog as CSV.

    ``limit=0`` means no cap (export everything that matches).
    """
    repo = ProductRepository(session)
    f = ProductFilter(
        search=search,
        category=category,
        brand=brand,
        validation_status=validationStatus,
        enrichment_status=enrichmentStatus,
        review_status=reviewStatus,
        price_min=priceMin,
        price_max=priceMax,
    )
    s = ProductSort(field=sortField, direction=sortDirection)
    page_size = limit if limit > 0 else max(1, await repo.total())
    response = await repo.list(filter=f, sort=s, page=1, page_size=page_size)

    return StreamingResponse(
        _csv_iterator(response.rows),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="granary-catalog.csv"',
            "X-Total-Rows": str(response.filtered_total),
        },
    )
