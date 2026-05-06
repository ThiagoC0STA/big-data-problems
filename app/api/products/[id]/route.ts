import { db } from "@/lib/server/db";
import { validateProduct, statusFromIssues } from "@/lib/server/validation";
import {
  rowToProduct,
  productToRow,
  err,
  buildValidationContext,
  nowIso,
} from "@/lib/server/utils";
import type { ProductPatch } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) return err(404, "not_found", `Product ${id} not found.`);
  return Response.json(rowToProduct(data));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data: existing } = await db
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return err(404, "not_found", `Product ${id} not found.`);

  const patch: ProductPatch = await req.json();
  const current = rowToProduct(existing);

  const merged = {
    ...current,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.brand !== undefined && { brand: patch.brand }),
    ...(patch.category !== undefined && { category: patch.category }),
    ...(patch.subcategory !== undefined && { subcategory: patch.subcategory }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.priceCents !== undefined && { priceCents: patch.priceCents }),
    ...(patch.inventory !== undefined && { inventory: patch.inventory }),
    ...(patch.barcode !== undefined && { barcode: patch.barcode }),
    ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl }),
    ...(patch.weightG !== undefined && { weightG: patch.weightG }),
    ...(patch.tags !== undefined && { tags: patch.tags }),
    ...(patch.reviewStatus !== undefined && { reviewStatus: patch.reviewStatus }),
    updatedAt: nowIso(),
  };

  const ctx = await buildValidationContext(merged.sku);
  const issues = validateProduct(merged, ctx);
  merged.validationIssues = issues;
  merged.validationStatus = statusFromIssues(issues);

  const { data: updated, error } = await db
    .from("products")
    .update(productToRow(merged))
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return err(500, "db_error", error.message, true);
  return Response.json(rowToProduct(updated!));
}
