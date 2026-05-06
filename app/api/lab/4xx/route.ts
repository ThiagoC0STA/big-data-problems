export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      code: "lab_4xx",
      message: "Simulated client validation error.",
      retryable: false,
    },
    { status: 422 },
  );
}
