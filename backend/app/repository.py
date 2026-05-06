"""SQL-backed product repository (Postgres via SQLAlchemy 2.0 async)."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Base, ProductModel, model_to_pydantic, pydantic_to_row
from .schemas import (
    BulkPatchRequest,
    BulkPatchResponse,
    Product,
    ProductFilter,
    ProductPatch,
    ProductSort,
    ProductsResponse,
    ValidationIssue,
)
from .seed import CATEGORIES_TREE, stream_products
from .validation import ValidationContext, status_from_issues, validate_product

log = logging.getLogger("granary.repo")

_SORT_ATTR: dict[str, str] = {
    "name": "name",
    "brand": "brand",
    "category": "category",
    "priceCents": "price_cents",
    "inventory": "inventory",
    "validationStatus": "validation_status",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        clean = s.replace("Z", "+00:00") if s.endswith("Z") else s
        return datetime.fromisoformat(clean)
    except ValueError:
        return None


# --------------------------------------------------------------------- repo


class ProductRepository:
    """All catalog reads/writes go through this. Session-scoped."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---------------------------------------------------------- read

    async def total(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(ProductModel))
        return int(result.scalar_one())

    async def get(self, product_id: str) -> Product | None:
        m = await self.session.get(ProductModel, product_id)
        return model_to_pydantic(m) if m else None

    async def categories(self) -> list[str]:
        stmt = select(ProductModel.category).distinct().order_by(ProductModel.category)
        result = await self.session.execute(stmt)
        return [r[0] for r in result.all()]

    async def brands(self) -> list[str]:
        stmt = (
            select(ProductModel.brand)
            .where(ProductModel.brand != "")
            .distinct()
            .order_by(ProductModel.brand)
        )
        result = await self.session.execute(stmt)
        return [r[0] for r in result.all()]

    async def list(
        self,
        *,
        filter: ProductFilter | None = None,
        sort: ProductSort | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> ProductsResponse:
        start = time.perf_counter()
        filter = filter or ProductFilter()
        sort = sort or ProductSort()
        page = max(1, page)
        page_size = max(1, min(page_size, 1000))

        base = select(ProductModel)
        count_q = select(func.count()).select_from(ProductModel)
        for cond in self._where_clauses(filter):
            base = base.where(cond)
            count_q = count_q.where(cond)

        sort_attr = _SORT_ATTR.get(sort.field, "name")
        sort_col = getattr(ProductModel, sort_attr)
        base = base.order_by(
            sort_col.desc() if sort.direction == "desc" else sort_col.asc(),
            ProductModel.id.asc(),
        )
        offset = (page - 1) * page_size
        base = base.limit(page_size).offset(offset)

        rows_result = await self.session.execute(base)
        models = list(rows_result.scalars().all())
        filtered_total = int((await self.session.execute(count_q)).scalar_one())
        total = await self.total()

        duration = (time.perf_counter() - start) * 1000
        return ProductsResponse(
            rows=[model_to_pydantic(m) for m in models],
            total=total,
            filtered_total=filtered_total,
            page=page,
            page_size=page_size,
            duration_ms=round(duration, 3),
        )

    # ---------------------------------------------------------- write

    async def patch(self, product_id: str, patch: ProductPatch) -> Product | None:
        m = await self.session.get(ProductModel, product_id)
        if m is None:
            return None
        self._apply_patch_to_model(m, patch)
        await self._revalidate(m)
        await self.session.commit()
        await self.session.refresh(m)
        return model_to_pydantic(m)

    async def bulk_patch(self, request: BulkPatchRequest) -> BulkPatchResponse:
        if not request.ids:
            return BulkPatchResponse(updated=0, not_found=[])

        stmt = select(ProductModel).where(ProductModel.id.in_(request.ids))
        result = await self.session.execute(stmt)
        models = list(result.scalars().all())
        found_ids = {m.id for m in models}
        not_found = [i for i in request.ids if i not in found_ids]

        ctx = await self._build_context()
        for m in models:
            self._apply_patch_to_model(m, request.patch)
            self._revalidate_with_context(m, ctx)

        await self.session.commit()
        return BulkPatchResponse(updated=len(models), not_found=not_found)

    async def replace(self, product: Product) -> Product:
        """Upsert helper used by enrichment + lab."""
        m = await self.session.get(ProductModel, product.id)
        now = _now()
        if m is None:
            m = ProductModel(
                id=product.id,
                sku=product.sku,
                name=product.name,
                brand=product.brand,
                category=product.category,
                subcategory=product.subcategory,
                description=product.description,
                price_cents=product.price_cents,
                currency="USD",
                inventory=product.inventory,
                barcode=product.barcode,
                image_url=product.image_url,
                weight_g=product.weight_g,
                tags=list(product.tags),
                enrichment_status=product.enrichment_status,
                validation_status=product.validation_status,
                validation_issues=[i.model_dump() for i in product.validation_issues],
                review_status=product.review_status,
                created_at=_parse_iso(product.created_at) or now,
                updated_at=now,
            )
            self.session.add(m)
        else:
            m.sku = product.sku
            m.name = product.name
            m.brand = product.brand
            m.category = product.category
            m.subcategory = product.subcategory
            m.description = product.description
            m.price_cents = product.price_cents
            m.inventory = product.inventory
            m.barcode = product.barcode
            m.image_url = product.image_url
            m.weight_g = product.weight_g
            m.tags = list(product.tags)
            m.enrichment_status = product.enrichment_status
            m.validation_status = product.validation_status
            m.validation_issues = [i.model_dump() for i in product.validation_issues]
            m.review_status = product.review_status
            m.updated_at = now

        await self._revalidate(m)
        await self.session.commit()
        await self.session.refresh(m)
        return model_to_pydantic(m)

    async def force_corrupt(self, product_id: str) -> Product | None:
        m = await self.session.get(ProductModel, product_id)
        if m is None:
            return None
        issues = list(m.validation_issues or [])
        issues.append(
            ValidationIssue(
                code="corrupt_record",
                severity="error",
                field="*",
                message="Lab-injected corruption.",
            ).model_dump()
        )
        m.validation_issues = issues
        m.validation_status = "error"
        m.updated_at = _now()
        await self.session.commit()
        await self.session.refresh(m)
        return model_to_pydantic(m)

    # ---------------------------------------------------------- internals

    def _where_clauses(self, f: ProductFilter):
        if f.search:
            needle = f"%{f.search}%"
            yield (
                ProductModel.name.ilike(needle)
                | ProductModel.sku.ilike(needle)
                | ProductModel.brand.ilike(needle)
                | ProductModel.category.ilike(needle)
            )
        if f.category:
            yield ProductModel.category == f.category
        if f.brand:
            yield ProductModel.brand == f.brand
        if f.validation_status:
            yield ProductModel.validation_status == f.validation_status
        if f.enrichment_status:
            yield ProductModel.enrichment_status == f.enrichment_status
        if f.review_status:
            yield ProductModel.review_status == f.review_status
        if f.price_min is not None:
            yield ProductModel.price_cents >= f.price_min
        if f.price_max is not None:
            yield ProductModel.price_cents <= f.price_max

    def _apply_patch_to_model(self, m: ProductModel, patch: ProductPatch) -> None:
        data = patch.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(m, key, value)
        m.updated_at = _now()

    async def _revalidate(self, m: ProductModel) -> None:
        ctx = await self._build_context()
        self._revalidate_with_context(m, ctx)

    def _revalidate_with_context(self, m: ProductModel, ctx: ValidationContext) -> None:
        product = model_to_pydantic(m)
        issues = validate_product(product, ctx)
        m.validation_issues = [i.model_dump() for i in issues]
        m.validation_status = status_from_issues(issues)

    async def _build_context(self) -> ValidationContext:
        # Find SKUs that occur more than once, in a single query.
        dup_stmt = (
            select(ProductModel.sku, func.count())
            .group_by(ProductModel.sku)
            .having(func.count() > 1)
        )
        result = await self.session.execute(dup_stmt)
        sku_counts: dict[str, int] = {row[0]: int(row[1]) for row in result.all()}
        return ValidationContext(
            known_categories=set(CATEGORIES_TREE.keys()),
            sku_counts=sku_counts,
        )


# --------------------------------------------------------------------- seeding


async def populate_if_empty(
    session: AsyncSession,
    *,
    count: int,
    seed: int,
    defect_rate: float,
    batch_size: int = 1000,
) -> int:
    """Seed the products table if it is empty. Returns rows inserted."""
    existing = int(
        (
            await session.execute(select(func.count()).select_from(ProductModel))
        ).scalar_one()
    )
    if existing > 0:
        log.info("products table already has %s rows; skipping seed", existing)
        return 0

    log.info("streaming %s products in chunks of %s…", count, batch_size)
    ctx = ValidationContext(
        known_categories=set(CATEGORIES_TREE.keys()),
        sku_counts={},
    )
    now = _now()
    inserted = 0
    chunk: list[dict] = []

    for p in stream_products(count=count, seed=seed, defect_rate=defect_rate):
        issues = validate_product(p, ctx)
        validated = p.model_copy(
            update={
                "validation_issues": issues,
                "validation_status": status_from_issues(issues),
            }
        )
        ca = _parse_iso(validated.created_at) or now
        ua = _parse_iso(validated.updated_at) or now
        chunk.append(pydantic_to_row(validated, created_at=ca, updated_at=ua))

        if len(chunk) >= batch_size:
            await session.execute(pg_insert(ProductModel).values(chunk))
            await session.commit()
            inserted += len(chunk)
            log.info("inserted %s/%s", inserted, count)
            chunk = []

    if chunk:
        await session.execute(pg_insert(ProductModel).values(chunk))
        await session.commit()
        inserted += len(chunk)
    log.info("seed complete: %s rows", inserted)
    return inserted


__all__ = ["Base", "ProductRepository", "populate_if_empty"]
