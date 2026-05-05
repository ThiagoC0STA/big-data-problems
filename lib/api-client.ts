/**
 * Typed client for the Python FastAPI backend.
 *
 * Every list/read response that contains products goes through `safeParseProducts`
 * so a single bad row cannot crash an entire view.
 */

import { apiFetch, apiUrl } from "./http";
import { safeParseProduct, safeParseProducts } from "./schemas";
import type {
  CatalogStats,
  EnrichmentJob,
  Product,
  ProductFilter,
  ProductPatch,
  ProductSort,
  ProductsResponse,
} from "./types";

// --------------------------------------------------------------------- Products

export interface ListProductsArgs {
  filter?: ProductFilter;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export async function listProducts(args: ListProductsArgs = {}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  if (args.filter?.search) qs.set("search", args.filter.search);
  if (args.filter?.category) qs.set("category", args.filter.category);
  if (args.filter?.brand) qs.set("brand", args.filter.brand);
  if (args.filter?.validationStatus) qs.set("validationStatus", args.filter.validationStatus);
  if (args.filter?.enrichmentStatus) qs.set("enrichmentStatus", args.filter.enrichmentStatus);
  if (args.filter?.reviewStatus) qs.set("reviewStatus", args.filter.reviewStatus);
  if (args.filter?.priceMin !== undefined && args.filter.priceMin !== null) {
    qs.set("priceMin", String(args.filter.priceMin));
  }
  if (args.filter?.priceMax !== undefined && args.filter.priceMax !== null) {
    qs.set("priceMax", String(args.filter.priceMax));
  }
  if (args.sort?.field) qs.set("sortField", args.sort.field);
  if (args.sort?.direction) qs.set("sortDirection", args.sort.direction);
  qs.set("page", String(args.page ?? 1));
  qs.set("pageSize", String(args.pageSize ?? 100));

  const raw = await apiFetch<ProductsResponse>(`/products?${qs}`, { signal: args.signal });
  const { products } = safeParseProducts(raw.rows);
  return { ...raw, rows: products };
}

export async function getProduct(id: string, opts?: { signal?: AbortSignal }): Promise<Product> {
  const raw = await apiFetch<unknown>(`/products/${encodeURIComponent(id)}`, opts);
  return safeParseProduct(raw).product;
}

export async function patchProduct(id: string, patch: ProductPatch): Promise<Product> {
  const raw = await apiFetch<unknown>(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return safeParseProduct(raw).product;
}

export async function bulkPatchProducts(args: {
  ids: string[];
  patch: ProductPatch;
}): Promise<{ updated: number; notFound: string[] }> {
  return apiFetch(`/products/bulk`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function getCategories(opts?: { signal?: AbortSignal }): Promise<string[]> {
  return apiFetch<string[]>(`/products/meta/categories`, opts);
}

export function exportProductsUrl(
  filter?: ProductFilter,
  sort?: ProductSort,
  limit = 0,
): string {
  const qs = new URLSearchParams();
  if (filter?.search) qs.set("search", filter.search);
  if (filter?.category) qs.set("category", filter.category);
  if (filter?.brand) qs.set("brand", filter.brand);
  if (filter?.validationStatus) qs.set("validationStatus", filter.validationStatus);
  if (filter?.enrichmentStatus) qs.set("enrichmentStatus", filter.enrichmentStatus);
  if (filter?.reviewStatus) qs.set("reviewStatus", filter.reviewStatus);
  if (filter?.priceMin !== undefined && filter.priceMin !== null) {
    qs.set("priceMin", String(filter.priceMin));
  }
  if (filter?.priceMax !== undefined && filter.priceMax !== null) {
    qs.set("priceMax", String(filter.priceMax));
  }
  if (sort?.field) qs.set("sortField", sort.field);
  if (sort?.direction) qs.set("sortDirection", sort.direction);
  if (limit > 0) qs.set("limit", String(limit));
  return apiUrl(`/products/-/export?${qs}`);
}

export async function getBrands(opts?: { signal?: AbortSignal }): Promise<string[]> {
  return apiFetch<string[]>(`/products/meta/brands`, opts);
}

// --------------------------------------------------------------------- Stats

export async function getStats(opts?: { signal?: AbortSignal }): Promise<CatalogStats> {
  return apiFetch<CatalogStats>(`/stats`, opts);
}

// --------------------------------------------------------------------- Enrichment

export interface CreateEnrichmentJobArgs {
  productIds: string[];
  fields?: Array<"description" | "tags" | "category">;
}

export async function createEnrichmentJob(args: CreateEnrichmentJobArgs): Promise<EnrichmentJob> {
  return apiFetch<EnrichmentJob>(`/enrich`, {
    method: "POST",
    body: JSON.stringify({
      productIds: args.productIds,
      fields: args.fields ?? ["description", "tags", "category"],
    }),
  });
}

export async function getEnrichmentJob(jobId: string): Promise<EnrichmentJob> {
  return apiFetch<EnrichmentJob>(`/enrich/${encodeURIComponent(jobId)}`);
}

export function enrichmentStreamPath(jobId: string): string {
  return `/enrich/${encodeURIComponent(jobId)}/stream`;
}

// --------------------------------------------------------------------- Lab

export async function getSampleProducts(count = 50): Promise<Product[]> {
  const raw = await apiFetch<unknown>(`/lab/sample-products?count=${count}`);
  const { products } = safeParseProducts(raw);
  return products;
}

export async function triggerCorruptRow(productId: string): Promise<Product> {
  const raw = await apiFetch<unknown>(`/lab/corrupt-row/${encodeURIComponent(productId)}`, {
    method: "POST",
  });
  return safeParseProduct(raw).product;
}

export async function triggerCorruptRandom(): Promise<Product> {
  const raw = await apiFetch<unknown>(`/lab/corrupt-random`, { method: "POST" });
  return safeParseProduct(raw).product;
}

export async function triggerLab500(): Promise<unknown> {
  return apiFetch(`/lab/500`);
}

export async function triggerLab400(): Promise<unknown> {
  return apiFetch(`/lab/4xx`);
}

export async function triggerLabSlow(seconds = 2.5): Promise<unknown> {
  return apiFetch(`/lab/slow?seconds=${seconds}`, { timeoutMs: (seconds + 5) * 1000 });
}

export async function triggerLabReset(): Promise<{ status: string; catalogSize: number }> {
  return apiFetch(`/lab/reset`, { method: "POST" });
}
