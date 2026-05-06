/** Shared helpers for API route handlers */

import type { Product } from "@/lib/types";
import { db } from "./db";
import { CATEGORIES } from "./seed-data";
import type { ValidationContext } from "./validation";

export function rowToProduct(row: Record<string, unknown>): Product {
  const ts = (s: unknown) =>
    new Date(s as string).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    id: row.id as string,
    sku: row.sku as string,
    name: row.name as string,
    brand: row.brand as string,
    category: row.category as string,
    subcategory: (row.subcategory as string) ?? null,
    description: (row.description as string) ?? null,
    priceCents: row.price_cents as number,
    currency: "USD",
    inventory: row.inventory as number,
    barcode: (row.barcode as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    weightG: (row.weight_g as number) ?? null,
    tags: (row.tags as string[]) ?? [],
    enrichmentStatus: row.enrichment_status as Product["enrichmentStatus"],
    validationStatus: row.validation_status as Product["validationStatus"],
    validationIssues: (row.validation_issues as Product["validationIssues"]) ?? [],
    reviewStatus: row.review_status as Product["reviewStatus"],
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}

export function productToRow(p: Product): Record<string, unknown> {
  return {
    id: p.id, sku: p.sku, name: p.name, brand: p.brand,
    category: p.category, subcategory: p.subcategory ?? null,
    description: p.description ?? null, price_cents: p.priceCents,
    currency: p.currency, inventory: p.inventory,
    barcode: p.barcode ?? null, image_url: p.imageUrl ?? null,
    weight_g: p.weightG ?? null, tags: p.tags,
    enrichment_status: p.enrichmentStatus,
    validation_status: p.validationStatus,
    validation_issues: p.validationIssues,
    review_status: p.reviewStatus,
    created_at: p.createdAt, updated_at: p.updatedAt,
  };
}

export function err(
  status: number,
  code: string,
  message: string,
  retryable = false,
): Response {
  return Response.json({ code, message, retryable }, { status });
}

export async function buildValidationContext(sku: string): Promise<ValidationContext> {
  const { data } = await db.from("products").select("sku").eq("sku", sku);
  const count = data?.length ?? 0;
  return {
    knownCategories: new Set(CATEGORIES),
    skuCounts: count > 1 ? { [sku]: count } : {},
  };
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
