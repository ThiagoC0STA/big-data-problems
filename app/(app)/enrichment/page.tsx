"use client";

import { ArrowRight, Sparkles, Wifi, WifiOff } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WidgetEmpty, WidgetSkeleton } from "@/components/fallbacks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type StreamStatus, useEnrichmentStream } from "@/hooks/use-enrichment-stream";
import { useProductsQuery } from "@/hooks/use-products";
import { createEnrichmentJob } from "@/lib/api-client";
import { formatRelative } from "@/lib/format";
import type { EnrichmentJob, Product, SSEEnrichmentEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELDS: Array<"description" | "tags" | "category"> = ["description", "tags", "category"];

export default function EnrichmentPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Snapshot of products before the job started, keyed by product id.
  // Used to render before/after diffs as SSE events arrive.
  const snapshotRef = useRef<Map<string, Product>>(new Map());

  const candidates = useProductsQuery({
    filter: { enrichmentStatus: "pending" },
    sort: { field: "updatedAt", direction: "desc" },
    page: 1,
    pageSize: 25,
  });

  const stream = useEnrichmentStream(jobId);

  const startJob = async () => {
    if (!candidates.data) return;
    const targets = candidates.data.rows.slice(0, 25);
    const ids = targets.map((p) => p.id);
    if (ids.length === 0) {
      toast.info("No pending products. Reset the catalog or pick more.");
      return;
    }
    snapshotRef.current = new Map(targets.map((p) => [p.id, p]));
    setCreating(true);
    try {
      const job = await createEnrichmentJob({ productIds: ids, fields: FIELDS });
      setJobId(job.id);
      toast.success(`Enrichment job ${job.id} started.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start job.");
    } finally {
      setCreating(false);
    }
  };

  const orderedEvents = useMemo(() => stream.events.slice().reverse(), [stream.events]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">AI enrichment</h1>
        <p className="text-sm text-muted-foreground">
          Calls Claude API to fill description, tags, and category for products that need help.
          Streams updates over SSE with polling fallback if the stream drops. Each finished
          product shows a before/after diff so you can see what the model did.
        </p>
      </header>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            new job
          </Badge>
          <span className="text-sm">
            {candidates.isLoading
              ? "Loading candidates…"
              : `${candidates.data?.filteredTotal ?? 0} products pending enrichment`}
          </span>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Fields:
            {FIELDS.map((f) => (
              <Badge key={f} variant="secondary" className="text-[10px]">
                {f}
              </Badge>
            ))}
          </span>
        </div>
        <Button
          onClick={startJob}
          disabled={creating || !!jobId || candidates.isLoading}
          className="w-fit gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {creating ? "Creating…" : "Enrich next 25 products"}
        </Button>
      </Card>

      {jobId ? (
        <JobPanel job={stream.job} status={stream.status} retries={stream.retries} />
      ) : null}

      {jobId ? (
        <Card className="flex flex-col gap-2 p-4">
          <header className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live feed · before / after
            </span>
            <ConnectionBadge status={stream.status} retries={stream.retries} />
          </header>
          {orderedEvents.length === 0 ? (
            <WidgetSkeleton variant="rows" rows={5} />
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <ul className="flex flex-col gap-2 text-xs">
                {orderedEvents.map((ev, idx) => (
                  <FeedItem
                    key={`${ev.type}-${idx}`}
                    event={ev}
                    before={ev.productId ? snapshotRef.current.get(ev.productId) : undefined}
                  />
                ))}
              </ul>
            </ScrollArea>
          )}
        </Card>
      ) : (
        <WidgetEmpty
          title="No active job"
          description="Click Enrich to start. /lab demonstrates how the SSE reconnect handles a dropped stream."
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------- feed item

function FeedItem({ event, before }: { event: SSEEnrichmentEvent; before?: Product }) {
  if (event.type === "product_updated" && event.product && before) {
    return <DiffRow before={before} after={event.product} />;
  }
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border border-border/40 px-2.5 py-1.5",
        event.type === "error" && "border-destructive/30",
      )}
    >
      <Badge variant="outline" className="text-[10px]">
        {event.type}
      </Badge>
      <span className="font-mono opacity-70">{event.productId ?? event.jobId}</span>
      {event.message ? <span className="opacity-70">{event.message}</span> : null}
    </li>
  );
}

function DiffRow({ before, after }: { before: Product; after: Product }) {
  const descChanged = before.description !== after.description;
  const tagsChanged = !sameStringArray(before.tags, after.tags);
  const catChanged = before.category !== after.category;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-success/30 bg-success/5 p-3">
      <header className="flex items-center gap-2">
        <Badge variant="outline" className="border-success/40 text-success">
          enriched
        </Badge>
        <span className="truncate font-medium">{after.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{after.sku}</span>
      </header>

      {descChanged ? (
        <FieldDiff label="description" before={before.description} after={after.description} />
      ) : null}

      {tagsChanged ? (
        <FieldDiff
          label="tags"
          before={before.tags.length ? before.tags.join(", ") : null}
          after={after.tags.length ? after.tags.join(", ") : null}
        />
      ) : null}

      {catChanged ? (
        <FieldDiff label="category" before={before.category} after={after.category} />
      ) : null}

      {!descChanged && !tagsChanged && !catChanged ? (
        <p className="text-[11px] text-muted-foreground">
          The model decided the existing values were good enough.
        </p>
      ) : null}
    </li>
  );
}

function FieldDiff({
  label,
  before,
  after,
}: {
  label: string;
  before: string | null | undefined;
  after: string | null | undefined;
}) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_16px_minmax(0,1fr)] items-start gap-2 text-[11px]">
      <span className="pt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="rounded-sm bg-destructive/10 px-2 py-1 text-muted-foreground line-through decoration-destructive/40">
        {before || <span className="italic opacity-60">empty</span>}
      </div>
      <ArrowRight className="mt-1 h-3 w-3 self-start text-muted-foreground" aria-hidden />
      <div className="rounded-sm bg-success/10 px-2 py-1 text-foreground">
        {after || <span className="italic opacity-60">empty</span>}
      </div>
    </div>
  );
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// --------------------------------------------------------------------- job panel

function JobPanel({
  job,
  status,
  retries,
}: {
  job: EnrichmentJob | null;
  status: StreamStatus;
  retries: number;
}) {
  if (!job) {
    return <WidgetSkeleton variant="card" />;
  }
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {job.status}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
        <ConnectionBadge status={status} retries={retries} className="ml-auto" />
      </div>
      <Progress value={pct} className="h-2" />
      <div className="grid grid-cols-4 gap-3 text-xs">
        <Stat label="Total" value={job.total} />
        <Stat label="Processed" value={job.processed} />
        <Stat label="Succeeded" value={job.succeeded} />
        <Stat label="Failed" value={job.failed} />
      </div>
      <div className="text-[11px] text-muted-foreground">
        Started {formatRelative(job.startedAt)}
        {job.completedAt ? ` · finished ${formatRelative(job.completedAt)}` : ""}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function ConnectionBadge({
  status,
  retries,
  className,
}: {
  status: StreamStatus;
  retries: number;
  className?: string;
}) {
  const map: Record<StreamStatus, { label: string; tone: string; icon: React.ReactNode }> = {
    idle: { label: "idle", tone: "text-muted-foreground", icon: <Wifi className="h-3 w-3" /> },
    connected: { label: "connected", tone: "text-success", icon: <Wifi className="h-3 w-3" /> },
    retrying: {
      label: `retrying (${retries})`,
      tone: "text-warning",
      icon: <Wifi className="h-3 w-3 animate-pulse" />,
    },
    polling: {
      label: "polling fallback",
      tone: "text-blue-400",
      icon: <Wifi className="h-3 w-3" />,
    },
    lost: { label: "lost", tone: "text-destructive", icon: <WifiOff className="h-3 w-3" /> },
    complete: { label: "complete", tone: "text-success", icon: <Wifi className="h-3 w-3" /> },
  };
  const it = map[status];
  return (
    <span className={cn("flex items-center gap-1 text-[11px]", it.tone, className)}>
      {it.icon}
      {it.label}
    </span>
  );
}
