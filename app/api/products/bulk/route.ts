import { db } from "@/lib/server/db";
import { validateProduct, statusFromIssues } from "@/lib/server/validation";
import { rowToProduct, productToRow, err, nowIso } from "@/lib/server/utils";
import { CATEGORIES } from "@/lib/server/seed-data";
import type { ProductPatch } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body: { ids: string[]; patch: ProductPatch } = await req.json();
  if (!body.ids?.length) return err(400, "bad_request", "ids required.");

  const { data: rows } = await db.from("products").select("*").in("id", body.ids);
  const foundIds = new Set((rows ?? []).map((r) => r.id as string));
  const notFound = body.ids.filter((id) => !foundIds.has(id));

  if (!rows?.length) return Response.json({ updated: 0, notFound });

  const skus = [...new Set(rows.map((r) => r.sku as string))];
  const { data: skuRows } = await db.from("products").select("sku").in("sku", skus);
  const skuCounts: Record<string, number> = {};
  for (const r of skuRows ?? []) {
    skuCounts[r.sku as string] = (skuCounts[r.sku as string] ?? 0) + 1;
  }
  const ctx = { knownCategories: new Set(CATEGORIES), skuCounts };
  const p = body.patch;
  const now = nowIso();

  const updates = rows.map((row) => {
    const current = rowToProduct(row);
    const merged = {
      ...current,
      ...(p.name !== undefined && { name: p.name }),
      ...(p.brand !== undefined && { brand: p.brand }),
      ...(p.category !== undefined && { category: p.category }),
      ...(p.subcategory !== undefined && { subcategory: p.subcategory }),
      ...(p.description !== undefined && { description: p.description }),
      ...(p.priceCents !== undefined && { priceCents: p.priceCents }),
      ...(p.inventory !== undefined && { inventory: p.inventory }),
      ...(p.barcode !== undefined && { barcode: p.barcode }),
      ...(p.imageUrl !== undefined && { imageUrl: p.imageUrl }),
      ...(p.weightG !== undefined && { weightG: p.weightG }),
      ...(p.tags !== undefined && { tags: p.tags }),
      ...(p.reviewStatus !== undefined && { reviewStatus: p.reviewStatus }),
      updatedAt: now,
    };
    const issues = validateProduct(merged, ctx);
    merged.validationIssues = issues;
    merged.validationStatus = statusFromIssues(issues);
    return productToRow(merged);
  });

  const { error } = await db.from("products").upsert(updates, { onConflict: "id" });
  if (error) return err(500, "db_error", error.message, true);

  return Response.json({ updated: updates.length, notFound });
}
