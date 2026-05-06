import { db } from "@/lib/server/db";

export async function GET() {
  const { data } = await db
    .from("products")
    .select("brand")
    .neq("brand", "")
    .order("brand");
  const unique = [...new Set((data ?? []).map((r) => r.brand as string))];
  return Response.json(unique);
}
