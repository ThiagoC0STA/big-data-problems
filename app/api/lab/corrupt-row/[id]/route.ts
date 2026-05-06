import { db } from "@/lib/server/db";
import { rowToProduct, err, nowIso } from "@/lib/server/utils";

export const dynamic = "force-dynamic";

const CORRUPT_ISSUE = {
  code: "corrupt_record",
  severity: "error",
  field: "*",
  message: "Lab-injected corruption.",
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data: row } = await db
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return err(404, "not_found", `Product ${id} not found.`);

  const issues = [...((row.validation_issues as unknown[]) ?? []), CORRUPT_ISSUE];

  const { data: updated, error } = await db
    .from("products")
    .update({
      validation_issues: issues,
      validation_status: "error",
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return err(500, "db_error", error.message, true);
  return Response.json(rowToProduct(updated!));
}
