export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seconds = Math.min(25, Math.max(0, Number(searchParams.get("seconds") ?? 2.5)));
  await new Promise((r) => setTimeout(r, seconds * 1000));
  return Response.json({ sleptFor: seconds });
}
