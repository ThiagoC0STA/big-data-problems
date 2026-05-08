import { db } from "@/lib/server/db";

export const maxDuration = 60;

export async function GET() {
  const t0 = performance.now();

  // Fast path: read the precomputed singleton cache row.
  const cached = await db.rpc("get_cached_stats");
  const dbMs = performance.now() - t0;

  if (!cached.error && cached.data) {
    const totalMs = performance.now() - t0;
    return Response.json(cached.data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "Server-Timing": `db;desc="cache_hit";dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
      },
    });
  }

  // Cold path: cache row missing. Compute live and warm the cache for next time.
  const { data, error } = await db.rpc("get_catalog_stats");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  void db.rpc("refresh_stats_cache");

  const totalMs = performance.now() - t0;
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Server-Timing": `db;desc="cache_miss";dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
    },
  });
}
