# Granary

**A full-stack workspace for high-volume product data.**
Validate, enrich, and edit a half-million-row catalog without the UI breaking a sweat.

🔗 **Live demo:** [granary-one.vercel.app](https://granary-one.vercel.app)

---

## What this is

Granary is a complete product data platform built end-to-end in a single day to demonstrate every requirement of an e-commerce product-data engineering role:

- **Big data on the frontend** — 500,000 products in a virtualized table, server-side filter / sort / paginate
- **Validation that scales** — 12-rule engine flagging missing fields, broken pricing, duplicate SKUs, weight outliers
- **AI enrichment that ships** — Claude with prompt caching, retry-on-transient, deterministic offline fallback
- **Real-time without breakage** — SSE for job progress with reconnect + polling fallback
- **Resilience as a feature** — per-widget error boundaries, per-row containment, defensive Zod parsing
- **Editable bulk workflows** — single-product editor, bulk patch endpoint accepting up to 10K ids per call

Everything visible in the running app maps to a concrete behavior, not a slide.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router + Cache Components), React 19, TypeScript 5 |
| Styling | Tailwind v4, shadcn/ui (base-ui primitives) |
| State / cache | TanStack Query (smart retry + cache), TanStack Table + Virtual |
| Charts | Recharts |
| Backend | Next.js Route Handlers under `/app/api`, Zod validation |
| Database | Supabase Postgres (RPC for stats, GIN trigram indexes for search) |
| AI | Anthropic Claude with prompt caching |
| Deploy | Vercel (edge cache + serverless) |

---

## Performance posture

The catalog ships with **500,000 rows** seeded deterministically. Things that matter at this scale and how they're handled:

- **Stats endpoint** — single-pass aggregate RPC in Postgres + edge cache (`s-maxage=300, stale-while-revalidate=3600`)
- **Catalog list** — `count: estimated` (planner-based, microseconds) instead of `count: exact` (full scan)
- **Search** — `pg_trgm` GIN indexes on `name`, `sku`, `brand` so `ILIKE '%foo%'` is indexed; 400ms client-side debounce
- **Distinct lookups** — `categories` and `brands` use Postgres `DISTINCT` RPCs, not 500K-row downloads
- **Virtualized rendering** — TanStack Virtual keeps DOM nodes only for visible rows, regardless of dataset size
- **Resilience** — every widget is its own error boundary; one bad chart never blanks the page

---

## Local setup (5 minutes)

```bash
git clone https://github.com/ThiagoC0STA/big-data-problems.git granary
cd granary
npm install

cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
```

Apply the schema in `supabase/schema.sql` via the Supabase SQL Editor (creates the `products` table, indexes, RPCs, and trigram extension), then:

```bash
npm run seed   # populates the configured CATALOG_SIZE (default 50k, bump to 500000 for the full demo)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project layout

```
app/
  (app)/                # the application shell + pages
    page.tsx            # home / dashboard
    catalog/            # virtualized 500K-row table
    validation/         # rule violations queue
    enrichment/         # AI enrichment with SSE progress
    lab/                # resilience playground (4xx, 5xx, slow, corrupt rows)
  api/                  # Route Handlers — REST + SSE
    products/           # list, get, patch, bulk
    stats/              # single optimized RPC
    enrich/             # job create + SSE stream
    lab/                # deliberate failure surfaces
components/             # UI, catalog, fallbacks, resilience boundaries
hooks/                  # TanStack Query hooks
lib/
  server/               # db client, validation engine, seed generator
  api-client.ts         # typed fetch wrappers with Zod
supabase/schema.sql     # tables, indexes, RPCs, pg_trgm setup
scripts/seed.ts         # batched seed that resumes from existing count
```

---

## What each page proves

- **`/`** — data viz at scale, problem-to-solution mapping, system-level architecture overview
- **`/catalog`** — 500K-row table with server-side filter/sort, debounced trigram search, server pagination
- **`/validation`** — bulk approve / reject / needs-changes queue with rule taxonomy and chips
- **`/enrichment`** — AI job creation, SSE live progress, polling fallback when SSE drops
- **`/lab`** — error boundaries in action: kill a widget, kill a row, force a 500, simulate offline

---

## The resilience lab

Open `/lab`. It demonstrates 12 distinct techniques the rest of Granary uses to never white-screen:

1. Route-level error boundary (`error.tsx`)
2. Widget-level boundary (`WidgetBoundary` wrapping React Query's reset boundary)
3. **Row-level boundary in a virtualized table** — a single bad row becomes `<RowFallback/>` while the others keep scrolling
4. Defensive Zod parsing with `.catch()` per field
5. TanStack Query smart retry (4xx skip, 5xx exponential backoff, max 3)
6. Stale-while-revalidate cache headers + last-known-good UI
7. SSE reconnect + polling fallback for enrichment
8. API failure taxonomy (`HttpError` → retryable / fatal)
9. Granular skeleton fallbacks per widget
10. Mutation invalidation (catalog edits stay consistent without page reload)
11. Network offline detection (`useOnlineStatus`)
12. Lab reset endpoint to rebuild state

Each section has a "Trigger failure" button. The rest of the app keeps working while the contained failure happens.

---

## Why this exists

Built as a portfolio piece for a product-data engineering role. The shape mirrors the job description: data-heavy frontend, large-dataset techniques (virtualization, pagination, caching), AI-driven workflows, Python interop (the original backend was FastAPI on Fly.io, then migrated to Next.js Route Handlers on Vercel), and resilience under failure.

Built in one day. The bar was: ship every requirement, end-to-end, in production.

---

## License

MIT
