import { db } from "@/lib/server/db";

export const maxDuration = 60;

export async function GET() {
  const { data, error } = await db.rpc("get_catalog_stats");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
