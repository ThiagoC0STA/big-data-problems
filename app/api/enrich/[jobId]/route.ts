import { db } from "@/lib/server/db";
import { err } from "@/lib/server/utils";

function jobToResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    productIds: row.product_ids,
    status: row.status,
    total: row.total,
    processed: row.processed,
    succeeded: row.succeeded,
    failed: row.failed,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    errorMessage: row.error_message ?? null,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const { data } = await db
    .from("enrichment_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) return err(404, "not_found", "Job not found.");
  return Response.json(jobToResponse(data));
}
