"""Validation engine. Pure functions producing ValidationIssue lists."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Callable

from .schemas import Product, ValidationIssue, ValidationStatus

Rule = Callable[[Product, "ValidationContext"], list[ValidationIssue]]


class ValidationContext:
    """Aggregate context shared by all rules (e.g. SKU duplicates)."""

    __slots__ = ("known_categories", "sku_counts")

    def __init__(self, known_categories: set[str], sku_counts: dict[str, int]) -> None:
        self.known_categories = known_categories
        self.sku_counts = sku_counts

    @classmethod
    def build(
        cls,
        products: Iterable[Product],
        known_categories: Iterable[str],
    ) -> "ValidationContext":
        counts: dict[str, int] = {}
        for p in products:
            counts[p.sku] = counts.get(p.sku, 0) + 1
        return cls(known_categories=set(known_categories), sku_counts=counts)


def _issue(code, severity, field, message) -> ValidationIssue:
    return ValidationIssue(code=code, severity=severity, field=field, message=message)


# --------------------------------------------------------------------------- Rules


def rule_missing_description(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if p.description is None or not p.description.strip():
        return [_issue("missing_description", "warning", "description", "Description is missing.")]
    return []


def rule_missing_brand(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if not p.brand or not p.brand.strip():
        return [_issue("missing_brand", "warning", "brand", "Brand is empty.")]
    return []


def rule_missing_image(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if not p.image_url:
        return [_issue("missing_image", "info", "imageUrl", "No image URL set.")]
    return []


def rule_missing_barcode(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if not p.barcode:
        return [_issue("missing_barcode", "info", "barcode", "Barcode missing.")]
    return []


def rule_duplicate_sku(p: Product, ctx: ValidationContext) -> list[ValidationIssue]:
    if ctx.sku_counts.get(p.sku, 0) > 1:
        return [_issue("duplicate_sku", "error", "sku", f"SKU {p.sku} occurs more than once.")]
    return []


def rule_invalid_price(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if p.price_cents <= 0:
        return [_issue("invalid_price", "error", "priceCents", "Price must be positive.")]
    return []


def rule_price_out_of_range(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if p.price_cents > 0 and p.price_cents > 100_000_00:
        return [_issue("price_out_of_range", "warning", "priceCents", "Price looks unrealistic.")]
    return []


def rule_low_inventory(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if p.inventory == 0:
        return [_issue("low_inventory", "warning", "inventory", "Out of stock.")]
    if p.inventory < 5:
        return [_issue("low_inventory", "info", "inventory", "Inventory is low.")]
    return []


def rule_name_length(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    out: list[ValidationIssue] = []
    if len(p.name) < 5:
        out.append(_issue("name_too_short", "warning", "name", "Name is suspiciously short."))
    if len(p.name) > 200:
        out.append(_issue("name_too_long", "warning", "name", "Name exceeds 200 chars."))
    return out


def rule_category_unknown(p: Product, ctx: ValidationContext) -> list[ValidationIssue]:
    if p.category not in ctx.known_categories:
        return [_issue("category_unknown", "error", "category", f"Unknown category: {p.category}.")]
    return []


def rule_weight_implausible(p: Product, _ctx: ValidationContext) -> list[ValidationIssue]:
    if p.weight_g is not None and p.weight_g > 50_000:
        return [_issue("weight_implausible", "warning", "weightG", "Weight exceeds 50kg.")]
    return []


RULES: list[Rule] = [
    rule_missing_description,
    rule_missing_brand,
    rule_missing_image,
    rule_missing_barcode,
    rule_duplicate_sku,
    rule_invalid_price,
    rule_price_out_of_range,
    rule_low_inventory,
    rule_name_length,
    rule_category_unknown,
    rule_weight_implausible,
]


def validate_product(p: Product, ctx: ValidationContext) -> list[ValidationIssue]:
    out: list[ValidationIssue] = []
    for rule in RULES:
        out.extend(rule(p, ctx))
    return out


def status_from_issues(issues: list[ValidationIssue]) -> ValidationStatus:
    if any(i.severity == "error" for i in issues):
        return "error"
    if any(i.severity == "warning" for i in issues):
        return "warning"
    return "ok"


__all__ = ["RULES", "ValidationContext", "status_from_issues", "validate_product"]
