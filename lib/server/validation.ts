/** Validation engine — TypeScript port of backend/app/validation.py */

import type { Product, ValidationIssue, ValidationStatus } from "@/lib/types";

export interface ValidationContext {
  knownCategories: Set<string>;
  skuCounts: Record<string, number>;
}

function issue(
  code: ValidationIssue["code"],
  severity: ValidationIssue["severity"],
  field: string,
  message: string,
): ValidationIssue {
  return { code, severity, field, message };
}

function ruleMissingDescription(p: Product): ValidationIssue[] {
  return !p.description?.trim()
    ? [issue("missing_description", "warning", "description", "Description is missing.")]
    : [];
}
function ruleMissingBrand(p: Product): ValidationIssue[] {
  return !p.brand?.trim()
    ? [issue("missing_brand", "warning", "brand", "Brand is empty.")]
    : [];
}
function ruleMissingImage(p: Product): ValidationIssue[] {
  return !p.imageUrl
    ? [issue("missing_image", "info", "imageUrl", "No image URL set.")]
    : [];
}
function ruleMissingBarcode(p: Product): ValidationIssue[] {
  return !p.barcode
    ? [issue("missing_barcode", "info", "barcode", "Barcode missing.")]
    : [];
}
function ruleDuplicateSku(p: Product, ctx: ValidationContext): ValidationIssue[] {
  return (ctx.skuCounts[p.sku] ?? 0) > 1
    ? [issue("duplicate_sku", "error", "sku", `SKU ${p.sku} occurs more than once.`)]
    : [];
}
function ruleInvalidPrice(p: Product): ValidationIssue[] {
  return p.priceCents <= 0
    ? [issue("invalid_price", "error", "priceCents", "Price must be positive.")]
    : [];
}
function rulePriceOutOfRange(p: Product): ValidationIssue[] {
  return p.priceCents > 0 && p.priceCents > 10_000_000
    ? [issue("price_out_of_range", "warning", "priceCents", "Price looks unrealistic.")]
    : [];
}
function ruleLowInventory(p: Product): ValidationIssue[] {
  if (p.inventory === 0) return [issue("low_inventory", "warning", "inventory", "Out of stock.")];
  if (p.inventory < 5) return [issue("low_inventory", "info", "inventory", "Inventory is low.")];
  return [];
}
function ruleNameLength(p: Product): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (p.name.length < 5) out.push(issue("name_too_short", "warning", "name", "Name is suspiciously short."));
  if (p.name.length > 200) out.push(issue("name_too_long", "warning", "name", "Name exceeds 200 chars."));
  return out;
}
function ruleCategoryUnknown(p: Product, ctx: ValidationContext): ValidationIssue[] {
  return !ctx.knownCategories.has(p.category)
    ? [issue("category_unknown", "error", "category", `Unknown category: ${p.category}.`)]
    : [];
}
function ruleWeightImplausible(p: Product): ValidationIssue[] {
  return p.weightG != null && p.weightG > 50_000
    ? [issue("weight_implausible", "warning", "weightG", "Weight exceeds 50kg.")]
    : [];
}

export function validateProduct(p: Product, ctx: ValidationContext): ValidationIssue[] {
  return [
    ...ruleMissingDescription(p),
    ...ruleMissingBrand(p),
    ...ruleMissingImage(p),
    ...ruleMissingBarcode(p),
    ...ruleDuplicateSku(p, ctx),
    ...ruleInvalidPrice(p),
    ...rulePriceOutOfRange(p),
    ...ruleLowInventory(p),
    ...ruleNameLength(p),
    ...ruleCategoryUnknown(p, ctx),
    ...ruleWeightImplausible(p),
  ];
}

export function statusFromIssues(issues: ValidationIssue[]): ValidationStatus {
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.some((i) => i.severity === "warning")) return "warning";
  if (issues.length > 0) return "ok";
  return "ok";
}
