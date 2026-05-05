"""SQLAlchemy ORM models. One row per product, JSONB for variable-shaped fields."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .schemas import Product, ValidationIssue


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class ProductModel(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    sku: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(Text, nullable=False)
    subcategory: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    inventory: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    barcode: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    enrichment_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    validation_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unreviewed"
    )
    validation_issues: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    review_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unreviewed"
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("ix_products_sku", "sku"),
        Index("ix_products_category", "category"),
        Index("ix_products_brand", "brand"),
        Index("ix_products_validation_status", "validation_status"),
        Index("ix_products_enrichment_status", "enrichment_status"),
        Index("ix_products_review_status", "review_status"),
        Index("ix_products_price_cents", "price_cents"),
        Index("ix_products_updated_at", "updated_at"),
    )


# --------------------------------------------------------------------- helpers


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (
        dt.astimezone(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def model_to_pydantic(m: ProductModel) -> Product:
    """Convert ORM row → Pydantic schema (camelCase wire format)."""
    return Product(
        id=m.id,
        sku=m.sku,
        name=m.name,
        brand=m.brand,
        category=m.category,
        subcategory=m.subcategory,
        description=m.description,
        price_cents=m.price_cents,
        currency="USD",
        inventory=m.inventory,
        barcode=m.barcode,
        image_url=m.image_url,
        weight_g=m.weight_g,
        tags=list(m.tags or []),
        enrichment_status=m.enrichment_status,  # type: ignore[arg-type]
        validation_status=m.validation_status,  # type: ignore[arg-type]
        validation_issues=[
            ValidationIssue.model_validate(i) for i in (m.validation_issues or [])
        ],
        review_status=m.review_status,  # type: ignore[arg-type]
        created_at=_iso(m.created_at),
        updated_at=_iso(m.updated_at),
    )


def pydantic_to_row(p: Product, *, created_at: datetime, updated_at: datetime) -> dict:
    """Row dict suitable for bulk insert."""
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "brand": p.brand,
        "category": p.category,
        "subcategory": p.subcategory,
        "description": p.description,
        "price_cents": p.price_cents,
        "currency": p.currency,
        "inventory": p.inventory,
        "barcode": p.barcode,
        "image_url": p.image_url,
        "weight_g": p.weight_g,
        "tags": list(p.tags),
        "enrichment_status": p.enrichment_status,
        "validation_status": p.validation_status,
        "validation_issues": [i.model_dump() for i in p.validation_issues],
        "review_status": p.review_status,
        "created_at": created_at,
        "updated_at": updated_at,
    }
