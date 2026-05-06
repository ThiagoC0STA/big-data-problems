import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data } = await db.from("products").select("category").order("category");
  const unique = [...new Set((data ?? []).map((r) => r.category as string))];
  return Response.json(unique);
}
