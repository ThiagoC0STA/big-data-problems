import { db } from "@/lib/server/db";

export const maxDuration = 30;

export async function GET() {
  const { data, error } = await db.rpc("list_distinct_categories");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? [], {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
