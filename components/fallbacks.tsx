/**
 * Fallback design system. Primitives every other component composes from.
 *
 * - <WidgetSkeleton/>   initial load
 * - <WidgetEmpty/>      query returned 0 results
 * - <WidgetError/>      query/render failed; offers retry
 * - <WidgetStale/>      fresh fetch in flight on top of last-known-good data
 * - <RowFallback/>      a single corrupt row inside a virtualized table
 * - <NetworkOffline/>   global strip when navigator.onLine === false
 * - <RouteErrorFallback/> reusable body for app/error.tsx files
 */

"use client";

import { AlertTriangle, FileX2, RefreshCcw, WifiOff } from "lucide-react";
import { type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------- skeleton

interface WidgetSkeletonProps {
  variant?: "card" | "rows" | "chart" | "metric" | "table";
  rows?: number;
  className?: string;
  label?: string;
}

export function WidgetSkeleton({
  variant = "card",
  rows = 6,
  className,
  label = "Loading",
}: WidgetSkeletonProps) {
  if (variant === "metric") {
    return (
      <Card aria-busy="true" aria-label={label} className={cn("flex flex-col gap-3 p-4", className)}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </Card>
    );
  }
  if (variant === "chart") {
    return (
      <Card aria-busy="true" aria-label={label} className={cn("p-4", className)}>
        <Skeleton className="mb-4 h-3 w-32" />
        <div className="flex h-44 items-end gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="w-full" style={{ height: `${20 + ((i * 13) % 70)}%` }} />
          ))}
        </div>
      </Card>
    );
  }
  if (variant === "rows" || variant === "table") {
    return (
      <div aria-busy="true" aria-label={label} className={cn("flex flex-col gap-1.5", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${50 + ((i * 17) % 40)}%` }} />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <Card aria-busy="true" aria-label={label} className={cn("space-y-3 p-4", className)}>
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-2/3" />
    </Card>
  );
}

// --------------------------------------------------------------------- empty

interface WidgetEmptyProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function WidgetEmpty({
  title = "Nothing to show",
  description = "There is no data here yet.",
  icon,
  action,
  className,
}: WidgetEmptyProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground">{icon ?? <FileX2 className="h-6 w-6" />}</div>
      <div className="text-sm font-medium">{title}</div>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}

// --------------------------------------------------------------------- error

interface WidgetErrorProps {
  title?: string;
  message?: string;
  error?: unknown;
  technique?: string;
  onRetry?: () => void;
  className?: string;
}

function describeError(err: unknown): string | undefined {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}

export function WidgetError({
  title = "Something broke here",
  message,
  error,
  technique,
  onRetry,
  className,
}: WidgetErrorProps) {
  const detail = message ?? describeError(error) ?? "An unexpected error occurred.";
  return (
    <Card
      role="alert"
      className={cn(
        "flex flex-col gap-3 border-destructive/30 bg-destructive/5 p-5 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="font-medium">{title}</span>
        {technique ? (
          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wide">
            {technique}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      {onRetry ? (
        <div>
          <Button onClick={onRetry} size="sm" variant="outline" className="gap-2">
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

// --------------------------------------------------------------------- stale

interface WidgetStaleProps {
  message?: string;
  className?: string;
}

export function WidgetStale({
  message = "Showing cached data while we refresh…",
  className,
}: WidgetStaleProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning",
        className,
      )}
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
      </span>
      <span>{message}</span>
    </div>
  );
}

// --------------------------------------------------------------------- row fallback

interface RowFallbackProps {
  rowId?: string;
  reason?: string;
  className?: string;
}

export function RowFallback({ rowId, reason, className }: RowFallbackProps) {
  return (
    <div
      role="row"
      className={cn(
        "flex items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Badge variant="outline" className="border-destructive/40 text-destructive">
        data quality issue
      </Badge>
      <span className="font-mono opacity-70">{rowId ?? "—"}</span>
      <span className="opacity-70">
        {reason ?? "Row could not be parsed and was replaced with a placeholder."}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------- network

export function NetworkOffline({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs text-warning",
        className,
      )}
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      <span>You are offline. Granary is showing the last data it had.</span>
    </div>
  );
}

// --------------------------------------------------------------------- route fallback

interface RouteErrorFallbackProps {
  error: unknown;
  reset?: () => void;
  segment?: string;
}

export function RouteErrorFallback({ error, reset, segment }: RouteErrorFallbackProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">
        {segment ? `route: ${segment}` : "route error"}
      </Badge>
      <h2 className="text-lg font-semibold">This route hit a snag.</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The rest of Granary is fine. The error was contained to this segment so the sidebar,
        topbar, and other routes keep working.
      </p>
      <WidgetError
        title="Segment failed"
        error={error}
        technique="route error.tsx"
        onRetry={reset}
        className="mt-2"
      />
    </div>
  );
}
