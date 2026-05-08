import { db } from "@/lib/server/db";
import { rowToProduct } from "@/lib/server/utils";

const SORT_COL: Record<string, string> = {
  name: "name", brand: "brand", category: "category",
  priceCents: "price_cents", inventory: "inventory",
  validationStatus: "validation_status",
  createdAt: "created_at", updatedAt: "updated_at",
};

export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams: p } = new URL(req.url);
  const search = p.get("search") ?? "";
  const category = p.get("category");
  const brand = p.get("brand");
  const validationStatus = p.get("validationStatus");
  const enrichmentStatus = p.get("enrichmentStatus");
  const reviewStatus = p.get("reviewStatus");
  const priceMin = p.get("priceMin") ? Number(p.get("priceMin")) : null;
  const priceMax = p.get("priceMax") ? Number(p.get("priceMax")) : null;
  const sortField = p.get("sortField") ?? "name";
  const sortDir = p.get("sortDirection") ?? "asc";
  const page = Math.max(1, Number(p.get("page") ?? 1));
  const pageSize = Math.min(1000, Math.max(1, Number(p.get("pageSize") ?? 100)));
  const offset = (page - 1) * pageSize;
  const sortCol = SORT_COL[sortField] ?? "name";
  const asc = sortDir !== "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (search && search.length >= 2) {
      q = q.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`,
      );
    }
    if (category) q = q.eq("category", category);
    if (brand) q = q.eq("brand", brand);
    if (validationStatus) q = q.eq("validation_status", validationStatus);
    if (enrichmentStatus) q = q.eq("enrichment_status", enrichmentStatus);
    if (reviewStatus) q = q.eq("review_status", reviewStatus);
    if (priceMin != null) q = q.gte("price_cents", priceMin);
    if (priceMax != null) q = q.lte("price_cents", priceMax);
    return q;
  }

  const t0 = performance.now();

  const [totalRes, filteredRes, rowsRes] = await Promise.all([
    db.from("products").select("*", { count: "estimated", head: true }),
    applyFilters(db.from("products").select("*", { count: "estimated", head: true })),
    applyFilters(db.from("products").select("*"))
      .order(sortCol, { ascending: asc })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1),
  ]);

  const dbMs = performance.now() - t0;
  const rows = (rowsRes.data ?? []).map(rowToProduct);
  const totalMs = performance.now() - t0;

  return Response.json(
    {
      rows,
      total: totalRes.count ?? 0,
      filteredTotal: filteredRes.count ?? 0,
      page,
      pageSize,
      durationMs: Math.round(totalMs * 10) / 10,
    },
    {
      headers: {
        "Server-Timing": `db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
      },
    },
  );
}
