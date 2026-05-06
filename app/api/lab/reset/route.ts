import { db } from "@/lib/server/db";
import { streamProducts, CATEGORIES } from "@/lib/server/seed-data";
import { validateProduct, statusFromIssues } from "@/lib/server/validation";
import { rowToProduct, productToRow, err } from "@/lib/server/utils";

export const maxDuration = 60;

const RESET_SIZE = 5000;
const BATCH = 500;

export async function POST() {
  const { error: truncErr } = await db.rpc("truncate_products");
  if (truncErr) return err(500, "db_error", truncErr.message, true);

  const ctx = { knownCategories: new Set(CATEGORIES), skuCounts: {} };

  const rows: Record<string, unknown>[] = [];
  for (const raw of streamProducts({ count: RESET_SIZE, seed: 1337, defectRate: 0.18 })) {
    const product = rowToProduct(raw as unknown as Record<string, unknown>);
    const issues = validateProduct(product, ctx);
    rows.push(
      productToRow({
        ...product,
        validationIssues: issues,
        validationStatus: statusFromIssues(issues),
      }),
    );
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error: insErr } = await db.from("products").insert(chunk);
    if (insErr) return err(500, "db_error", insErr.message, true);
  }

  return Response.json({ status: "ok", catalogSize: RESET_SIZE });
}
