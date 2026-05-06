export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { code: "lab_500", message: "Simulated server error.", retryable: true },
    { status: 500 },
  );
}
