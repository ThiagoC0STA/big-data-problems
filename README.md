# Granary

> Validate, enrich, and edit massive product catalogs at speed.

Granary is a portfolio demo for high-volume product data work: a virtualized catalog of
100K rows, an AI-driven enrichment pipeline streamed over SSE, a validation queue, a
charts dashboard, and a dedicated **resilience lab** that proves nothing breaks the whole
app when one widget fails.

It is built end-to-end as a single project. Frontend in TypeScript (Next.js 16 + React 19),
backend in Python (FastAPI + Pydantic), AI by Anthropic Claude.

## Stack

**Frontend** — Next.js 16, React 19, TypeScript, Tailwind v4, TanStack Query, TanStack
Table, TanStack Virtual, Recharts, shadcn/ui, Geist, Sonner.

**Backend** — Python 3.12, FastAPI, Pydantic 2, sse-starlette, Anthropic SDK.

**AI** — Claude Sonnet 4.5 with prompt caching.

## Run it locally

You need Node 20+, Python 3.12+, and (optionally) an Anthropic API key.

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .
cp .env.example .env  # optional: edit ANTHROPIC_API_KEY for real enrichment
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
npm install
cp .env.local.example .env.local
npm run dev
# Open http://localhost:3000
```

The first request to the backend warms a deterministic 100K-product catalog (~3-5s cold start).
Without `ANTHROPIC_API_KEY` set, enrichment runs in "offline mode" with synthetic outputs so the
demo still works end-to-end.

## Project layout

```
granary/
├── app/                      Next 16 App Router
│   ├── (app)/               app shell group
│   │   ├── catalog/         FEATURE: 100K virtualized table
│   │   ├── validation/      FEATURE: review queue
│   │   ├── enrichment/      FEATURE: AI job + SSE
│   │   ├── dashboard/       FEATURE: Recharts dashboard
│   │   └── lab/             FEATURE: resilience lab
│   ├── error.tsx            route boundary
│   ├── global-error.tsx     last-line-of-defense
│   └── page.tsx             marketing landing
├── components/
│   ├── catalog/             products-table, toolbar, detail pane
│   ├── layout/              app shell
│   ├── ui/                  shadcn primitives (untouched)
│   ├── fallbacks.tsx        WidgetSkeleton/Empty/Error/Stale + RowFallback
│   └── resilience.tsx       WidgetBoundary, RowErrorBoundary, useOnlineStatus
├── hooks/
│   ├── use-products.ts      TanStack Query hooks for products + stats
│   └── use-enrichment-stream.ts   SSE + polling fallback
├── lib/
│   ├── api-client.ts        typed Python backend client
│   ├── http.ts              HttpError + apiFetch with timeout
│   ├── schemas.ts           defensive Zod with .catch()
│   ├── types.ts             shared TS types (mirrors Pydantic)
│   ├── format.ts            price/date/number formatters
│   └── utils.ts             shadcn cn()
└── backend/                 FastAPI app (Python)
    ├── app/
    │   ├── main.py          app entry (CORS, exception handlers, routers)
    │   ├── config.py        env-driven settings
    │   ├── schemas.py       Pydantic models, camelCase wire format
    │   ├── seed.py          mulberry32 PRNG, 40 brands, 12 categories
    │   ├── repository.py    in-memory store, indexes, thread-safe writes
    │   ├── validation.py    12 rules → ValidationIssue
    │   ├── ai.py            Anthropic SDK + offline fallback
    │   ├── sse.py           SSE encoder
    │   └── routers/         products, stats, enrich, lab, health
    ├── pyproject.toml
    └── Dockerfile           Railway/Fly-ready
```

## Problems Solved

These map the demo to the explicit requirements of the role it was built for.

| Requirement                              | How Granary delivers it                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Virtualized tables** for 10K+ rows     | `components/catalog/products-table.tsx` uses TanStack Table + Virtual; 100K rows stay smooth    |
| **Pagination**                           | Cursor-style infinite scroll in `ProductsTable`; `lib/api-client.listProducts` paginates server |
| **Caching**                              | `components/providers/query-provider.tsx` configures TanStack Query with smart retry            |
| **Data editing workflows**               | `ProductDetailPane` with mutation via `usePatchProductMutation`                                 |
| **Validation workflows**                 | 12 rules in `backend/app/validation.py`; `ValidationIssue` surfaced in table + detail pane      |
| **Enrichment workflows + AI/ML UIs**     | `backend/app/ai.py` (Anthropic SDK) + `app/(app)/enrichment/page.tsx` (SSE live feed)           |
| **Validation queues** (nice-to-have)     | `app/(app)/validation/page.tsx` with bulk Approve / Reject / Needs changes                      |
| **Data visualization**                   | `app/(app)/dashboard/page.tsx` — Recharts BarChart + PieCharts                                  |
| **Python for backend**                   | All server logic in `backend/` (FastAPI + Pydantic + Anthropic SDK)                             |
| **Real-time data workflows**             | `backend/app/routers/enrich.py` SSE stream; `hooks/use-enrichment-stream.ts` reconnect+polling  |
| **AI/ML-driven interfaces**              | Claude API wrapper, prompt cache, 3-attempt retry, offline-mode fallback, batched job runner    |

## The resilience lab

Open `/lab` while running locally. It demonstrates 12 distinct techniques the rest of
Granary uses to never white-screen:

1. Route-level error boundary (`error.tsx`)
2. Widget-level boundary (`WidgetBoundary` over the React Query reset boundary)
3. **Row-level boundary in a virtualized table** — a single bad row becomes `<RowFallback/>` while the others keep scrolling
4. Defensive Zod parsing with `.catch()` per field
5. TanStack Query smart retry (4xx skip, 5xx exponential backoff, max 3)
6. Stale-while-revalidate (`<WidgetStale/>` on top of last-known-good data)
7. SSE reconnect + polling fallback for enrichment
8. API failure taxonomy (HttpError → retryable / fatal)
9. Granular skeleton fallbacks per widget
10. Mutation invalidation (catalog edits stay consistent without page reload)
11. Network offline detection (`useOnlineStatus`)
12. Lab reset endpoint

Each section has a "Trigger failure" button. The rest of the app keeps working while the
contained failure happens.

## Deploy

- **Frontend** → Vercel. Set `NEXT_PUBLIC_API_URL` to the backend URL.
- **Backend** → Railway or Fly. Build with the included `Dockerfile`. Set
  `ANTHROPIC_API_KEY` and `CORS_ORIGINS` (comma-separated origins, including the Vercel URL).

## Notes

- The catalog is synthetic and deterministic: same `CATALOG_SEED` produces the same 100K
  products. About 18% have intentional defects (missing description, invalid price, etc.)
  so the validation engine has work to do.
- Wire format is camelCase. Pydantic on the backend uses `alias_generator=to_camel`.
- SSE works fine without auth in this demo. A real product would put a signed token in
  the URL or use `EventSource` with `credentials: 'include'`.
