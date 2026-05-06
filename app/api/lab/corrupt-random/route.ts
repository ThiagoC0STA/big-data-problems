import { db } from "@/lib/server/db";
import { rowToProduct, err, nowIso } from "@/lib/server/utils";

const CORRUPT_ISSUE = {
  code: "corrupt_record",
  severity: "error",
  field: "*",
  message: "Lab-injected corruption.",
};

export async function POST() {
  const { count } = await db
    .from("products")
    .select("*", { count: "exact", head: true });
  const total = count ?? 0;
  if (total === 0) return err(404, "empty_catalog", "Catalog is empty.");

  const offset = Math.floor(Math.random() * total);
  const { data: row } = await db
    .from("products")
    .select("*")
    .range(offset, offset)
    .maybeSingle();
  if (!row) return err(404, "not_found", "No product found.");

  const issues = [...((row.validation_issues as unknown[]) ?? []), CORRUPT_ISSUE];

  const { data: updated, error } = await db
    .from("products")
    .update({
      validation_issues: issues,
      validation_status: "error",
      updated_at: nowIso(),
    })
    .eq("id", row.id)
    .select("*")
    .maybeSingle();

  if (error) return err(500, "db_error", error.message, true);
  return Response.json(rowToProduct(updated!));
}
