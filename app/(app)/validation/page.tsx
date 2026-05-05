"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { WidgetEmpty, WidgetError, WidgetSkeleton } from "@/components/fallbacks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkPatchMutation, useProductsQuery } from "@/hooks/use-products";
import { formatRelative } from "@/lib/format";
import type { Product, ReviewStatus, ValidationStatus } from "@/lib/types";

const SEVERITY_OPTIONS: { value: ValidationStatus; label: string }[] = [
  { value: "error", label: "Errors" },
  { value: "warning", label: "Warnings" },
  { value: "ok", label: "OK" },
];

export default function ValidationPage() {
  const [severity, setSeverity] = useState<ValidationStatus>("error");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | "any">("unreviewed");

  const filter = useMemo(
    () => ({
      validationStatus: severity,
      reviewStatus: reviewStatus === "any" ? null : reviewStatus,
    }),
    [severity, reviewStatus],
  );
  const query = useProductsQuery({
    filter,
    sort: { field: "updatedAt", direction: "desc" },
    page: 1,
    pageSize: 100,
  });

  const bulk = useBulkPatchMutation();

  const apply = (status: ReviewStatus) => {
    const ids = (query.data?.rows ?? []).map((p) => p.id);
    if (ids.length === 0) {
      toast.info("Queue is empty.");
      return;
    }
    bulk.mutate(
      { ids, patch: { reviewStatus: status } },
      {
        onSuccess: (res) => toast.success(`${status} applied to ${res.updated} products.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Bulk failed."),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Validation queue</h1>
        <p className="text-sm text-muted-foreground">
          12 rules surface duplicates, missing fields, and bad prices. Triage in batches.
        </p>
      </header>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Select value={severity} onValueChange={(v) => setSeverity(v as ValidationStatus)}>
          <SelectTrigger className="w-[160px]" aria-label="Severity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={reviewStatus}
          onValueChange={(v) => setReviewStatus(v as ReviewStatus | "any")}
        >
          <SelectTrigger className="w-[180px]" aria-label="Review status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All review states</SelectItem>
            <SelectItem value="unreviewed">Unreviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="needs_changes">Needs changes</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">
          {query.data?.filteredTotal ?? "—"} products
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => apply("approved")}
            disabled={bulk.isPending}
            className="gap-1"
          >
            <Check className="h-3.5 w-3.5" />
            Approve all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => apply("needs_changes")}
            disabled={bulk.isPending}
            className="gap-1"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Needs changes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => apply("rejected")}
            disabled={bulk.isPending}
            className="gap-1 text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      </Card>

      {query.isLoading ? (
        <WidgetSkeleton variant="rows" rows={10} />
      ) : query.isError ? (
        <WidgetError
          title="Could not load queue"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      ) : (query.data?.rows ?? []).length === 0 ? (
        <WidgetEmpty title="Queue is empty" description="No products match this filter." />
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <ul className="flex flex-col gap-2">
            {(query.data?.rows ?? []).map((p) => (
              <QueueItem key={p.id} product={p} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

function QueueItem({ product }: { product: Product }) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-border/60 bg-card p-3">
      <Badge
        variant="outline"
        className={
          product.validationStatus === "error"
            ? "border-destructive/40 text-destructive"
            : product.validationStatus === "warning"
              ? "border-warning/40 text-warning"
              : ""
        }
      >
        {product.validationStatus}
      </Badge>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{product.name}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{product.sku}</span>
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {product.validationIssues.map((issue, idx) => (
            <li key={`${issue.code}-${idx}`}>
              <Badge variant="secondary" className="text-[10px]">
                {issue.code}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatRelative(product.updatedAt)}
      </span>
    </li>
  );
}
