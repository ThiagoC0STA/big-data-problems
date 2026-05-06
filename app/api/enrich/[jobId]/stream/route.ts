import { db } from "@/lib/server/db";
import { enrichProduct } from "@/lib/server/enrichment";
import { validateProduct, statusFromIssues } from "@/lib/server/validation";
import {
  rowToProduct,
  productToRow,
  buildValidationContext,
  nowIso,
  err,
} from "@/lib/server/utils";

export const maxDuration = 60;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const { data: jobRow } = await db
    .from("enrichment_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!jobRow) return err(404, "not_found", "Job not found.");

  if (jobRow.status === "completed" || jobRow.status === "failed") {
    const payload = sse("complete", {
      type: "complete",
      jobId,
      processed: jobRow.processed,
      total: jobRow.total,
      message: jobRow.error_message ?? null,
    });
    return new Response(payload, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const productIds: string[] = (jobRow.product_ids as string[]) ?? [];
  const fields: string[] =
    (jobRow.fields as string[]) ?? ["description", "tags", "category"];

  const stream = new ReadableStream({
    async start(controller) {
      const enc = (s: string) => controller.enqueue(new TextEncoder().encode(s));

      await db
        .from("enrichment_jobs")
        .update({ status: "running", started_at: nowIso() })
        .eq("id", jobId);

      enc(
        sse("progress", {
          type: "progress",
          jobId,
          processed: 0,
          total: productIds.length,
        }),
      );

      let succeeded = 0;
      let failed = 0;
      let processed = 0;
      let errorMessage: string | null = null;

      try {
        for (const pid of productIds) {
          const { data: pRow } = await db
            .from("products")
            .select("*")
            .eq("id", pid)
            .maybeSingle();
          if (!pRow) {
            failed++;
            processed++;
            enc(
              sse("error", {
                type: "error",
                jobId,
                productId: pid,
                message: "Product missing.",
              }),
            );
            continue;
          }

          const product = rowToProduct(pRow);

          await db
            .from("products")
            .update({ enrichment_status: "running", updated_at: nowIso() })
            .eq("id", pid);

          try {
            const result = await enrichProduct(product, fields);
            const updated = {
              ...product,
              enrichmentStatus: "enriched" as const,
              ...(fields.includes("description") &&
                result.description && { description: result.description }),
              ...(fields.includes("tags") && result.tags && { tags: result.tags }),
              ...(fields.includes("category") &&
                result.category && { category: result.category }),
              updatedAt: nowIso(),
            };

            const ctx = await buildValidationContext(updated.sku);
            const issues = validateProduct(updated, ctx);
            updated.validationIssues = issues;
            updated.validationStatus = statusFromIssues(issues);

            await db.from("products").update(productToRow(updated)).eq("id", pid);

            succeeded++;
            processed++;
            await db
              .from("enrichment_jobs")
              .update({ succeeded, processed })
              .eq("id", jobId);

            enc(
              sse("product_updated", {
                type: "product_updated",
                jobId,
                productId: pid,
                product: updated,
                processed,
                total: productIds.length,
              }),
            );
          } catch (e) {
            failed++;
            processed++;
            await db
              .from("products")
              .update({ enrichment_status: "failed", updated_at: nowIso() })
              .eq("id", pid);
            await db
              .from("enrichment_jobs")
              .update({ failed, processed })
              .eq("id", jobId);
            enc(
              sse("error", {
                type: "error",
                jobId,
                productId: pid,
                message: String(e),
              }),
            );
          }
        }
      } catch (e) {
        errorMessage = String(e);
      } finally {
        const finalStatus = errorMessage ? "failed" : "completed";
        await db
          .from("enrichment_jobs")
          .update({
            status: finalStatus,
            completed_at: nowIso(),
            error_message: errorMessage,
            succeeded,
            failed,
            processed,
          })
          .eq("id", jobId);

        enc(
          sse("complete", {
            type: "complete",
            jobId,
            processed,
            total: productIds.length,
            message: errorMessage,
          }),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
