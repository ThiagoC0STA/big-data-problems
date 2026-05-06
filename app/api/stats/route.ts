import { db } from "@/lib/server/db";

export async function GET() {
  const { data, error } = await db.rpc("get_catalog_stats");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
