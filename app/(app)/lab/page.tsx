"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Beaker,
  Bomb,
  Flame,
  RefreshCcw,
  Skull,
  Snail,
  Zap,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { WidgetError, WidgetStale } from "@/components/fallbacks";
import { RowErrorBoundary, WidgetBoundary } from "@/components/resilience";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getSampleProducts,
  triggerCorruptRandom,
  triggerLab400,
  triggerLab500,
  triggerLabReset,
  triggerLabSlow,
} from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { safeParseProduct } from "@/lib/schemas";

export default function LabPage() {
  const [killRowIds, setKillRowIds] = useState<Set<string>>(new Set());
  const [crashRouteFlag, setCrashRouteFlag] = useState(false);
  const [crashWidgetFlag, setCrashWidgetFlag] = useState(false);

  if (crashRouteFlag) {
    throw new Error("Lab-injected route crash. The (app) error.tsx is showing right now.");
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
          resilience lab
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          Granary doesn&apos;t go down. Here&apos;s why.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Big-data UIs are tempting to write naively. One bad row, one 500, one dropped websocket
          and the whole page white-screens. The lab demonstrates the techniques the rest of Granary
          uses to keep going. Click any &ldquo;trigger&rdquo; below to see a contained failure.
        </p>
      </header>

      <Section
        n={1}
        title="Route-level error boundary"
        body="A component throws during render. The (app) error.tsx renders in place; the sidebar, topbar, and all other routes remain interactive."
        technique="error.tsx + reset"
      >
        <Button variant="outline" onClick={() => setCrashRouteFlag(true)} className="gap-2">
          <Bomb className="h-3.5 w-3.5" /> Crash this route
        </Button>
      </Section>

      <Section
        n={2}
        title="Widget-level boundary"
        body="A single widget throws. Only that card is replaced with the WidgetError fallback. Other widgets on the page keep their state and finish their work."
        technique="WidgetBoundary"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <WidgetBoundary technique="WidgetBoundary">
            <FlakyWidget shouldCrash={crashWidgetFlag} />
          </WidgetBoundary>
          <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            This widget is healthy. The other one&apos;s failure does not touch it.
          </Card>
        </div>
        <Button variant="outline" onClick={() => setCrashWidgetFlag((v) => !v)} className="gap-2">
          <Zap className="h-3.5 w-3.5" />
          {crashWidgetFlag ? "Heal widget" : "Crash widget"}
        </Button>
      </Section>

      <Section
        n={3}
        title="Row-level error boundary"
        body="A render error inside one row of a virtualized table is contained to that row. The other 99,999 keep scrolling."
        technique="RowErrorBoundary"
      >
        <MiniTable killRowIds={killRowIds} />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => corruptOneRow(setKillRowIds)} className="gap-2">
            <Flame className="h-3.5 w-3.5" /> Crash a random row
          </Button>
          <Button
            variant="ghost"
            onClick={() => setKillRowIds(new Set())}
            disabled={killRowIds.size === 0}
            className="gap-2"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Heal all rows
          </Button>
          <span className="text-xs text-muted-foreground">
            {killRowIds.size} row(s) currently exploding on render.
          </span>
        </div>
      </Section>

      <Section
        n={4}
        title="Defensive Zod parsing"
        body="A malformed product would normally crash the whole list. Instead we parse with .catch() per field, so a corrupted record becomes a row with sentinel values + a corrupt_record tag."
        technique="safeParseProduct"
      >
        <DefensiveParseDemo />
      </Section>

      <Section
        n={5}
        title="TanStack Query smart retry"
        body="A simulated 500 response is retried with exponential backoff. The HttpError class marks 5xx as retryable; 4xx (mostly) skip retry."
        technique="retry strategy"
      >
        <RetryDemo />
      </Section>

      <Section
        n={6}
        title="Stale-while-revalidate"
        body="A slow refetch keeps previous data on screen and surfaces a WidgetStale strip on top. The user is never blocked by a spinner that erases the page."
        technique="placeholderData"
      >
        <SlowDemo />
      </Section>

      <Section
        n={7}
        title="SSE reconnect + polling fallback"
        body="The /enrichment hook attempts EventSource with exponential backoff (5 tries) and falls back to polling every 3s. Try Network → Offline in DevTools while a job is running."
        technique="useEnrichmentStream"
      >
        <a href="/enrichment" className={buttonVariants({ variant: "outline" })}>
          Open /enrichment
        </a>
      </Section>

      <Section
        n={8}
        title="API failure taxonomy"
        body="Every API error is classified as retryable or not. 4xx (excluding 408/425/429) skip retry; 5xx and network errors retry. Triggering 400 below produces a non-retryable WidgetError."
        technique="HttpError"
      >
        <TaxonomyDemo />
      </Section>

      <Section
        n={9}
        title="Granular skeleton fallbacks"
        body="Each major widget on /dashboard has its own skeleton, so slow data on one chart never blocks the others."
        technique="WidgetSkeleton variants"
      >
        <a href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Open /dashboard
        </a>
      </Section>

      <Section
        n={10}
        title="Mutation invalidation"
        body="The /catalog detail pane saves edits via TanStack Query mutation; on success it invalidates the list and stats so the table updates without a page reload."
        technique="useMutation"
      >
        <a href="/catalog" className={buttonVariants({ variant: "outline" })}>
          Open /catalog
        </a>
      </Section>

      <Section
        n={11}
        title="Network offline detection"
        body="useOnlineStatus hooks navigator.onLine. The shell renders a banner when offline. Toggle airplane mode or DevTools' offline checkbox."
        technique="useOnlineStatus"
      >
        <Button
          variant="outline"
          onClick={() =>
            toast.info("Open DevTools → Network → Offline to demo. The banner appears at the top.")
          }
        >
          How to test
        </Button>
      </Section>

      <Section
        n={12}
        title="Reset the lab"
        body="Forget all corruptions and let the catalog regenerate."
        technique="reset endpoint"
      >
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const res = await triggerLabReset();
              toast.success(`Catalog reset (${res.catalogSize} products).`);
              setKillRowIds(new Set());
              setCrashWidgetFlag(false);
              setCrashRouteFlag(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not reset.");
            }
          }}
          className="gap-2"
        >
          <Skull className="h-3.5 w-3.5" /> Reset lab state
        </Button>
      </Section>
    </div>
  );
}

function Section({
  n,
  title,
  body,
  technique,
  children,
}: {
  n: number;
  title: string;
  body: string;
  technique?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" id={`technique-${n}`}>
      <Separator className="bg-border/60" />
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          #{n.toString().padStart(2, "0")}
        </Badge>
        <h2 className="text-base font-semibold">{title}</h2>
        {technique ? (
          <Badge variant="secondary" className="ml-auto text-[10px] uppercase tracking-wider">
            {technique}
          </Badge>
        ) : null}
      </header>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function FlakyWidget({ shouldCrash }: { shouldCrash: boolean }) {
  if (shouldCrash) {
    throw new Error("Widget intentionally exploded for the lab demo.");
  }
  return (
    <Card className="flex flex-col gap-2 p-4">
      <header className="flex items-center gap-2 text-sm font-medium">
        <Beaker className="h-4 w-4 text-primary" />
        Healthy widget
      </header>
      <p className="text-xs text-muted-foreground">
        I render fine. Click the toggle to make me throw on render. The boundary will catch it.
      </p>
    </Card>
  );
}

function MiniTable({ killRowIds }: { killRowIds: Set<string> }) {
  const sample = useQuery({
    queryKey: ["lab", "sample"],
    queryFn: () => getSampleProducts(50),
    staleTime: 60_000,
  });

  if (sample.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading sample…</p>;
  }
  if (sample.isError) {
    return (
      <WidgetError
        title="Sample load failed"
        error={sample.error}
        onRetry={() => sample.refetch()}
      />
    );
  }
  const rows = sample.data ?? [];
  return (
    <Card className="overflow-hidden p-0">
      <ul className="max-h-[360px] divide-y divide-border/40 overflow-auto">
        {rows.map((p) => (
          <RowErrorBoundary key={p.id} rowId={p.id}>
            <li className="grid grid-cols-[1fr_120px_80px] items-center gap-3 px-3 py-2 text-xs">
              {killRowIds.has(p.id) ? (
                <CrashOnRender />
              ) : (
                <>
                  <span className="truncate">{p.name}</span>
                  <span className="truncate text-muted-foreground">{p.brand || "—"}</span>
                  <span className="text-right font-mono">{formatPrice(p.priceCents)}</span>
                </>
              )}
            </li>
          </RowErrorBoundary>
        ))}
      </ul>
    </Card>
  );
}

function CrashOnRender(): never {
  throw new Error("Lab-injected row crash.");
}

function corruptOneRow(setKillRowIds: React.Dispatch<React.SetStateAction<Set<string>>>) {
  triggerCorruptRandom()
    .then((p) => {
      setKillRowIds((prev) => {
        const next = new Set(prev);
        next.add(p.id);
        return next;
      });
      toast.info(`Marked row ${p.id} as corrupt.`);
    })
    .catch((err) => toast.error(err instanceof Error ? err.message : "Lab call failed."));
}

function DefensiveParseDemo() {
  const [result, setResult] = useState<string | null>(null);
  return (
    <Card className="flex flex-col gap-2 p-4 text-xs">
      <p className="text-muted-foreground">
        Click below to parse a deliberately malformed payload (price as string, missing id, etc.).
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-2"
        onClick={() => {
          const malformed = {
            id: undefined,
            sku: 12345,
            name: 5,
            brand: null,
            category: undefined,
            priceCents: "abc",
            currency: "EUR",
            inventory: -1,
            tags: "not-an-array",
            validationIssues: "should be array",
          };
          const out = safeParseProduct(malformed);
          setResult(
            `${out.corrupted ? "CORRUPTED" : "OK"} — name: "${out.product.name}", price: ${out.product.priceCents}, currency: ${out.product.currency}`,
          );
        }}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Parse malformed payload
      </Button>
      {result ? (
        <pre className="rounded-md border border-border/40 bg-card p-2 font-mono">{result}</pre>
      ) : null}
    </Card>
  );
}

function RetryDemo() {
  const [running, setRunning] = useState(false);
  return (
    <Card className="flex flex-col gap-2 p-4 text-xs">
      <p className="text-muted-foreground">
        Calls /lab/500 directly. In real queries TanStack Query retries 3× before surfacing.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-2"
        disabled={running}
        onClick={async () => {
          setRunning(true);
          try {
            await triggerLab500();
            toast.success("Unexpectedly succeeded?");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed (as expected).");
          } finally {
            setRunning(false);
          }
        }}
      >
        <Bomb className="h-3.5 w-3.5" />
        Trigger 500
      </Button>
    </Card>
  );
}

function SlowDemo() {
  const [running, setRunning] = useState(false);
  return (
    <Card className="flex flex-col gap-2 p-4 text-xs">
      <p className="text-muted-foreground">
        Calls /lab/slow?seconds=3. /catalog renders WidgetStale on top of cached data while slow
        refetches resolve.
      </p>
      <WidgetStale message="A real /catalog refetch shows this strip." />
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-2"
        disabled={running}
        onClick={async () => {
          setRunning(true);
          try {
            await triggerLabSlow(3);
            toast.success("Slow call resolved.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Slow call failed.");
          } finally {
            setRunning(false);
          }
        }}
      >
        <Snail className="h-3.5 w-3.5" />
        Trigger 3s slow call
      </Button>
    </Card>
  );
}

function TaxonomyDemo() {
  return (
    <Card className="flex flex-col gap-2 p-4 text-xs">
      <ul className="grid grid-cols-2 gap-2 text-[11px]">
        <li className="rounded-md border border-border/40 px-2 py-1">2xx → success</li>
        <li className="rounded-md border border-border/40 px-2 py-1">4xx (most) → fail fast</li>
        <li className="rounded-md border border-border/40 px-2 py-1">408/425/429 → retry</li>
        <li className="rounded-md border border-border/40 px-2 py-1">5xx → retry w/ backoff</li>
        <li className="rounded-md border border-border/40 px-2 py-1">network → retry</li>
        <li className="rounded-md border border-border/40 px-2 py-1">timeout → 408 synth</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            try {
              await triggerLab400();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "400 demo failed.");
            }
          }}
        >
          Trigger 400
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            try {
              await triggerLab500();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "500 demo failed.");
            }
          }}
        >
          Trigger 500
        </Button>
      </div>
    </Card>
  );
}
