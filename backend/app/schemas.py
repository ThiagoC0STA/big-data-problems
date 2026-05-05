"""Pydantic schemas mirroring lib/types.ts.

Wire format is camelCase; Python attributes stay snake_case.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ValidationCode = Literal[
    "missing_description",
    "missing_brand",
    "missing_image",
    "missing_barcode",
    "duplicate_sku",
    "invalid_price",
    "price_out_of_range",
    "low_inventory",
    "name_too_short",
    "name_too_long",
    "category_unknown",
    "weight_implausible",
    "corrupt_record",
]

ValidationSeverity = Literal["info", "warning", "error"]
ValidationStatus = Literal["ok", "warning", "error", "unreviewed"]
EnrichmentStatus = Literal["pending", "queued", "running", "enriched", "failed"]
ReviewStatus = Literal["unreviewed", "approved", "rejected", "needs_changes"]
SortDirection = Literal["asc", "desc"]
SortField = Literal[
    "name",
    "brand",
    "category",
    "priceCents",
    "inventory",
    "validationStatus",
    "createdAt",
    "updatedAt",
]
Currency = Literal["USD"]


class CamelModel(BaseModel):
    """Base model that emits camelCase on the wire and accepts both names."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ValidationIssue(CamelModel):
    code: ValidationCode
    severity: ValidationSeverity
    field: str
    message: str


class Product(CamelModel):
    id: str
    sku: str
    name: str
    brand: str
    category: str
    subcategory: str | None
    description: str | None
    price_cents: int
    currency: Currency
    inventory: int
    barcode: str | None
    image_url: str | None
    weight_g: int | None
    tags: list[str]
    enrichment_status: EnrichmentStatus
    validation_status: ValidationStatus
    validation_issues: list[ValidationIssue]
    review_status: ReviewStatus
    created_at: str
    updated_at: str


class ProductPatch(CamelModel):
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    subcategory: str | None = None
    description: str | None = None
    price_cents: int | None = None
    inventory: int | None = None
    barcode: str | None = None
    image_url: str | None = None
    weight_g: int | None = None
    tags: list[str] | None = None
    review_status: ReviewStatus | None = None


class ProductFilter(CamelModel):
    search: str | None = None
    category: str | None = None
    brand: str | None = None
    validation_status: ValidationStatus | None = None
    enrichment_status: EnrichmentStatus | None = None
    review_status: ReviewStatus | None = None
    price_min: int | None = None
    price_max: int | None = None


class ProductSort(CamelModel):
    field: SortField = "name"
    direction: SortDirection = "asc"


class ProductsResponse(CamelModel):
    rows: list[Product]
    total: int
    filtered_total: int
    page: int
    page_size: int
    duration_ms: float


class CategoryCount(CamelModel):
    category: str
    count: int


class BrandCount(CamelModel):
    brand: str
    count: int


class IssueBreakdown(CamelModel):
    code: ValidationCode
    count: int


class PriceBucket(CamelModel):
    bucket: str
    count: int
    min: int
    max: int


class InventoryHealth(CamelModel):
    healthy: int
    low: int
    out: int


class CatalogStats(CamelModel):
    total: int
    by_category: list[CategoryCount]
    by_validation: dict[str, int]
    by_review: dict[str, int]
    price_buckets: list[PriceBucket]
    top_brands: list[BrandCount]
    validation_issue_breakdown: list[IssueBreakdown]
    inventory_health: InventoryHealth


class BulkPatchRequest(CamelModel):
    ids: list[str] = Field(min_length=1, max_length=10000)
    patch: ProductPatch


class BulkPatchResponse(CamelModel):
    updated: int
    not_found: list[str]


class EnrichmentJobRequest(CamelModel):
    product_ids: list[str] = Field(min_length=1, max_length=500)
    fields: list[Literal["description", "tags", "category"]] = Field(
        default_factory=lambda: ["description", "tags", "category"],
    )


class EnrichmentJob(CamelModel):
    id: str
    product_ids: list[str]
    status: Literal["queued", "running", "completed", "failed"]
    total: int
    processed: int
    succeeded: int
    failed: int
    started_at: str | None
    completed_at: str | None
    error_message: str | None


class SSEEnrichmentEvent(CamelModel):
    type: Literal["progress", "product_updated", "complete", "error"]
    job_id: str
    product_id: str | None = None
    processed: int | None = None
    total: int | None = None
    product: Product | None = None
    message: str | None = None


class ApiError(CamelModel):
    code: str
    message: str
    retryable: bool
    details: dict | None = None
