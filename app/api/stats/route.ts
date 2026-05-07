import { db } from "@/lib/server/db";

export const maxDuration = 60;

export async function GET() {
  const t0 = performance.now();
  const { data, error } = await db.rpc("get_catalog_stats");
  const dbMs = performance.now() - t0;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const totalMs = performance.now() - t0;
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Server-Timing": `db;desc="get_catalog_stats";dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
    },
  });
}
