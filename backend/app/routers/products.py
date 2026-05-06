"""Product CRUD endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
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

