import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Granary — Validate, enrich, and edit massive product catalogs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(ellipse at top left, #1a2e1a 0%, #0a0a0a 55%, #000 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#9eff5d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: "#0a0a0a",
              fontWeight: 700,
            }}
          >
            G
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
              Granary
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              product data infrastructure
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.04,
              maxWidth: 1000,
            }}
          >
            Validate, enrich, and edit massive product catalogs at speed.
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#9ca3af",
              maxWidth: 980,
              lineHeight: 1.35,
            }}
          >
            500,000-row virtualized catalog · AI enrichment over Claude · validation
            queues · real-time SSE
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#9ca3af",
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {["Next.js 16", "TypeScript", "Supabase", "Claude"].map((t) => (
              <div
                key={t}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #2d2d2d",
                  borderRadius: 999,
                  fontSize: 18,
                  color: "#e5e7eb",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ color: "#9eff5d", fontWeight: 600 }}>
            granary-one.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
