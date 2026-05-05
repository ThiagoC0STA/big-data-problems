/**
 * Defensive Zod schemas. Every field has a `.catch()` so a single
 * malformed value cannot crash the whole parse. Corrupted rows still
 * produce a valid object with sentinel values, plus a `corrupted` flag
 * for UI to render `<RowFallback />`.
 */

import { z } from "zod";
import type { Product, ValidationIssue } from "./types";

const SENTINEL_DATE = "1970-01-01T00:00:00Z";

const validationCode = z
  .enum([
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
  ])
  .catch("corrupt_record");

const validationSeverity = z.enum(["info", "warning", "error"]).catch("warning");

const validationIssueSchema = z
  .object({
    code: validationCode,
    severity: validationSeverity,
    field: z.string().catch("*"),
    message: z.string().catch("Unknown issue."),
  })
  .catch({
    code: "corrupt_record",
    severity: "warning",
    field: "*",
    message: "Failed to parse validation issue.",
  });

const validationStatus = z
  .enum(["ok", "warning", "error", "unreviewed"])
  .catch("unreviewed");

const enrichmentStatus = z
  .enum(["pending", "queued", "running", "enriched", "failed"])
  .catch("pending");

const reviewStatus = z
  .enum(["unreviewed", "approved", "rejected", "needs_changes"])
  .catch("unreviewed");

export const productSchema = z.object({
  id: z.string().catch(() => `__corrupt_${Math.random().toString(36).slice(2, 10)}`),
  sku: z.string().catch("__missing__"),
  name: z.string().min(1).max(500).catch("(unknown product)"),
  brand: z.string().catch(""),
  category: z.string().catch("Pantry"),
  subcategory: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  priceCents: z.number().int().catch(0),
  currency: z.literal("USD").catch("USD" as const),
  inventory: z.number().int().nonnegative().catch(0),
  barcode: z.string().nullable().catch(null),
  imageUrl: z.string().nullable().catch(null),
  weightG: z.number().nullable().catch(null),
  tags: z.array(z.string()).catch([]),
  enrichmentStatus,
  validationStatus,
  validationIssues: z.array(validationIssueSchema).catch([]),
  reviewStatus,
  createdAt: z.string().catch(SENTINEL_DATE),
  updatedAt: z.string().catch(SENTINEL_DATE),
});

export type ParsedProduct = z.infer<typeof productSchema>;

export interface SafeProduct {
  product: Product;
  corrupted: boolean;
}

export function safeParseProduct(raw: unknown): SafeProduct {
  const result = productSchema.safeParse(raw);
  if (!result.success) {
    return { product: makeFallbackProduct(), corrupted: true };
  }
  const corrupted = detectCorruption(result.data);
  return { product: result.data as Product, corrupted };
}

export function safeParseProducts(raws: unknown): {
  products: Product[];
  corruptedCount: number;
} {
  if (!Array.isArray(raws)) return { products: [], corruptedCount: 0 };
  let corruptedCount = 0;
  const products: Product[] = [];
  for (const raw of raws) {
    const parsed = safeParseProduct(raw);
    if (parsed.corrupted) corruptedCount += 1;
    products.push(parsed.product);
  }
  return { products, corruptedCount };
}

function detectCorruption(p: ParsedProduct): boolean {
  if (p.id.startsWith("__corrupt_")) return true;
  if (p.sku === "__missing__") return true;
  if (p.name === "(unknown product)") return true;
  if (p.createdAt === SENTINEL_DATE) return true;
  if (p.validationIssues.some((i: ValidationIssue) => i.code === "corrupt_record")) return true;
  return false;
}

function makeFallbackProduct(): Product {
  return {
    id: `__corrupt_${Math.random().toString(36).slice(2, 10)}`,
    sku: "__missing__",
    name: "(unparseable product)",
    brand: "",
    category: "Pantry",
    subcategory: null,
    description: null,
    priceCents: 0,
    currency: "USD",
    inventory: 0,
    barcode: null,
    imageUrl: null,
    weightG: null,
    tags: [],
    enrichmentStatus: "pending",
    validationStatus: "error",
    validationIssues: [
      {
        code: "corrupt_record",
        severity: "error",
        field: "*",
        message: "Row failed schema parse entirely.",
      },
    ],
    reviewStatus: "unreviewed",
    createdAt: SENTINEL_DATE,
    updatedAt: SENTINEL_DATE,
  };
}
