"use client";

/**
 * Live performance HUD pinned to the bottom-right.
 *
 * - FPS sampled via requestAnimationFrame, rolling 1s window.
 * - Last query latency from TanStack Query cache events.
 * - JS heap size when the browser exposes it (Chromium only).
 *
 * Click the chip to expand/collapse.
 */

import { useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, ChevronUp, Cpu, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface Sample {
  fps: number;
  lastQueryMs: number | null;
  lastQueryName: string | null;
  heapMb: number | null;
}

const INITIAL: Sample = {
  fps: 0,
  lastQueryMs: null,
  lastQueryName: null,
  heapMb: null,
};

export function PerformanceHud() {
  const [sample, setSample] = useState<Sample>(INITIAL);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // FPS + heap loop
  useEffect(() => {
    let frames = 0;
    let lastTick = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames += 1;
      if (now - lastTick >= 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTick));
        const mem = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
        const heapMb = mem?.usedJSHeapSize
          ? Math.round(mem.usedJSHeapSize / 1024 / 1024)
          : null;
        setSample((prev) => ({ ...prev, fps, heapMb }));
        frames = 0;
        lastTick = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Subscribe to query cache for latency
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const startedAt = new Map<string, number>();
    const unsub = cache.subscribe((event) => {
      const hash = event.query.queryHash;
      const state = event.query.state;
      if (state.fetchStatus === "fetching" && !startedAt.has(hash)) {
        startedAt.set(hash, performance.now());
      } else if (state.fetchStatus === "idle" && startedAt.has(hash)) {
        const start = startedAt.get(hash) ?? performance.now();
        startedAt.delete(hash);
        const elapsed = performance.now() - start;
        const key = event.query.queryKey;
        const name =
          Array.isArray(key) && typeof key[0] === "string" ? (key[0] as string) : "query";
        setSample((prev) => ({
          ...prev,
          lastQueryMs: Math.round(elapsed),
          lastQueryName: name,
        }));
      }
    });
    return () => unsub();
  }, [queryClient]);

  const fpsTone =
    sample.fps >= 55
      ? "text-success"
      : sample.fps >= 30
        ? "text-warning"
        : "text-destructive";
  const queryTone =
    sample.lastQueryMs === null
      ? "text-muted-foreground"
      : sample.lastQueryMs < 100
        ? "text-success"
        : sample.lastQueryMs < 500
          ? "text-warning"
          : "text-destructive";

  return (
    <div className="pointer-events-none fixed bottom-12 right-3 z-40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-md border border-border/60 bg-card/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur transition-colors hover:bg-card"
        aria-expanded={open}
        aria-label="Performance HUD"
      >
        <Activity className="h-3 w-3 text-primary" aria-hidden />
        <span className={cn("font-mono", fpsTone)}>{sample.fps} fps</span>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <span className={cn("font-mono", queryTone)}>
          {sample.lastQueryMs === null ? "—" : `${sample.lastQueryMs} ms`}
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronUp className="h-3 w-3 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="pointer-events-auto mt-1 flex w-64 flex-col gap-1.5 rounded-md border border-border/60 bg-card/95 p-3 text-[11px] shadow-md backdrop-blur">
          <Row icon={<Zap className="h-3 w-3" />} label="FPS" value={`${sample.fps}`} tone={fpsTone} />
          <Row
            icon={<Activity className="h-3 w-3" />}
            label="Last query"
            value={
              sample.lastQueryMs === null
                ? "—"
                : `${sample.lastQueryMs} ms · ${sample.lastQueryName}`
            }
            tone={queryTone}
          />
          <Row
            icon={<Cpu className="h-3 w-3" />}
            label="JS heap"
            value={sample.heapMb === null ? "n/a (non-Chromium)" : `${sample.heapMb} MB`}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            FPS sampled with requestAnimationFrame. Query latency from TanStack cache events.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("font-mono", tone)}>{value}</span>
    </div>
  );
}
