/**
 * Core domain types for Granary.
 *
 * A Product is a single item in an e-commerce catalog. The full lifecycle:
 *   raw import  ->  validated  ->  enriched  ->  approved
 */

export type ValidationSeverity = "info" | "warning" | "error";

export type ValidationCode =
  | "missing_description"
  | "missing_brand"
  | "missing_image"
  | "missing_barcode"
  | "duplicate_sku"
  | "invalid_price"
  | "price_out_of_range"
  | "low_inventory"
  | "name_too_short"
  | "name_too_long"
  | "category_unknown"
  | "weight_implausible"
  | "corrupt_record";

export interface ValidationIssue {
  code: ValidationCode;
  severity: ValidationSeverity;
  /** Field name from Product, or "*" for cross-field issues. Free-form string for forward compatibility. */
  field: string;
  message: string;
}

export type ValidationStatus = "ok" | "warning" | "error" | "unreviewed";

export type EnrichmentStatus = "pending" | "queued" | "running" | "enriched" | "failed";

export type ReviewStatus = "unreviewed" | "approved" | "rejected" | "needs_changes";

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  priceCents: number;
  currency: "USD";
  inventory: number;
  barcode: string | null;
  imageUrl: string | null;
  weightG: number | null;
  tags: string[];
  enrichmentStatus: EnrichmentStatus;
  validationStatus: ValidationStatus;
  validationIssues: ValidationIssue[];
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPatch {
  name?: string;
  brand?: string;
  category?: string;
  subcategory?: string | null;
  description?: string | null;
  priceCents?: number;
  inventory?: number;
  barcode?: string | null;
  imageUrl?: string | null;
  weightG?: number | null;
  tags?: string[];
  reviewStatus?: ReviewStatus;
}

export interface ProductFilter {
  search?: string;
  category?: string | null;
  brand?: string | null;
  validationStatus?: ValidationStatus | null;
  enrichmentStatus?: EnrichmentStatus | null;
  reviewStatus?: ReviewStatus | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export type SortDirection = "asc" | "desc";

export type SortField =
  | "name"
  | "brand"
  | "category"
  | "priceCents"
  | "inventory"
  | "validationStatus"
  | "createdAt"
  | "updatedAt";

export interface ProductSort {
  field: SortField;
  direction: SortDirection;
}

export interface ProductsResponse {
  rows: Product[];
  total: number;
  filteredTotal: number;
  page: number;
  pageSize: number;
  durationMs: number;
}

export interface CatalogStats {
  total: number;
  byCategory: Array<{ category: string; count: number }>;
  byValidation: Record<ValidationStatus, number>;
  byReview: Record<ReviewStatus, number>;
  priceBuckets: Array<{ bucket: string; count: number; min: number; max: number }>;
  topBrands: Array<{ brand: string; count: number }>;
  validationIssueBreakdown: Array<{ code: ValidationCode; count: number }>;
  inventoryHealth: { healthy: number; low: number; out: number };
}

export interface EnrichmentJob {
  id: string;
  productIds: string[];
  status: "queued" | "running" | "completed" | "failed";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface SSEEnrichmentEvent {
  type: "progress" | "product_updated" | "complete" | "error";
  jobId: string;
  productId?: string;
  processed?: number;
  total?: number;
  product?: Product;
  message?: string;
}
