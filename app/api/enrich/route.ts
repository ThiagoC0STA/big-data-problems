import { db } from "@/lib/server/db";
import { err, nowIso } from "@/lib/server/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body: { productIds: string[]; fields?: string[] } = await req.json();
  if (!body.productIds?.length) return err(400, "bad_request", "productIds required.");

  const { data: existing } = await db
    .from("products")
    .select("id")
    .in("id", body.productIds);
  const validIds = (existing ?? []).map((r) => r.id as string);
  if (!validIds.length)
    return err(400, "no_valid_products", "None of the requested products exist.");

  const jobId = `job_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const fields = body.fields ?? ["description", "tags", "category"];

  const { error } = await db.from("enrichment_jobs").insert({
    id: jobId,
    product_ids: validIds,
    fields,
    status: "queued",
    total: validIds.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    started_at: null,
    completed_at: null,
    error_message: null,
    created_at: nowIso(),
  });
  if (error) return err(500, "db_error", error.message, true);

  return Response.json({
    id: jobId,
    productIds: validIds,
    status: "queued",
    total: validIds.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
  });
}
