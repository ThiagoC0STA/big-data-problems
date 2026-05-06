import { db } from "@/lib/server/db";
import { rowToProduct } from "@/lib/server/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(500, Math.max(1, Number(searchParams.get("count") ?? 50)));

  const { count: total } = await db
    .from("products")
    .select("*", { count: "exact", head: true });
  const totalRows = total ?? 0;
  if (totalRows === 0) return Response.json([]);

  const offset = Math.floor(Math.random() * Math.max(1, totalRows - count));
  const { data } = await db
    .from("products")
    .select("*")
    .range(offset, offset + count - 1);

  return Response.json((data ?? []).map(rowToProduct));
}
