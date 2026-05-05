"use client";

import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { WidgetError, WidgetSkeleton } from "@/components/fallbacks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useProductQuery, usePatchProductMutation } from "@/hooks/use-products";
import { formatPrice, formatRelative } from "@/lib/format";
import type { Product, ValidationIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DetailPaneProps {
  productId: string | null;
  onClose: () => void;
}

export function ProductDetailPane({ productId, onClose }: DetailPaneProps) {
  const open = !!productId;
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-hidden={!open}
        className={cn(
          "absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-border/60 bg-card shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-sm font-medium">Product detail</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close detail pane">
            <X className="h-4 w-4" />
          </Button>
        </header>
        {productId ? <ProductDetailBody productId={productId} /> : null}
      </aside>
    </>
  );
}

function ProductDetailBody({ productId }: { productId: string }) {
  const query = useProductQuery(productId);
  if (query.isLoading) {
    return <WidgetSkeleton className="m-4" />;
  }
  if (query.isError) {
    return (
      <WidgetError
        title="Could not load product"
        error={query.error}
        onRetry={() => query.refetch()}
        className="m-4"
      />
    );
  }
  if (!query.data) return null;
  return <ProductDetailForm product={query.data} />;
}

function ProductDetailForm({ product }: { product: Product }) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [priceText, setPriceText] = useState((product.priceCents / 100).toFixed(2));
  const [inventoryText, setInventoryText] = useState(String(product.inventory));

  useEffect(() => {
    setName(product.name);
    setDescription(product.description ?? "");
    setPriceText((product.priceCents / 100).toFixed(2));
    setInventoryText(String(product.inventory));
  }, [product.id, product.name, product.description, product.priceCents, product.inventory]);

  const mutation = usePatchProductMutation();

  const dirty =
    name !== product.name ||
    description !== (product.description ?? "") ||
    Number(priceText) !== product.priceCents / 100 ||
    Number(inventoryText) !== product.inventory;

  const onSave = () => {
    const priceCents = Math.round(Number(priceText) * 100);
    const inventory = Math.round(Number(inventoryText));
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error("Price must be a non-negative number.");
      return;
    }
    if (!Number.isFinite(inventory) || inventory < 0) {
      toast.error("Inventory must be a non-negative integer.");
      return;
    }
    mutation.mutate(
      {
        id: product.id,
        patch: { name, description: description || null, priceCents, inventory },
      },
      {
        onSuccess: () => toast.success("Saved."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed."),
      },
    );
  };

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-4 text-sm">
        <header className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted-foreground">{product.sku}</span>
          <h2 className="text-base font-semibold leading-tight">{product.name}</h2>
          <span className="text-xs text-muted-foreground">
            {product.brand || "(no brand)"} · {product.category}
          </span>
        </header>

        <ValidationList issues={product.validationIssues} />

        <div className="grid gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the product…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (USD)">
              <Input
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-muted-foreground">
                stored as {formatPrice(product.priceCents)}
              </span>
            </Field>
            <Field label="Inventory">
              <Input
                inputMode="numeric"
                value={inventoryText}
                onChange={(e) => setInventoryText(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Meta label="Status" value={product.validationStatus} />
          <Meta label="Review" value={product.reviewStatus} />
          <Meta label="Enrichment" value={product.enrichmentStatus} />
          <Meta label="Updated" value={formatRelative(product.updatedAt)} />
        </dl>

        <Button onClick={onSave} disabled={!dirty || mutation.isPending} className="mt-2 gap-2">
          <Save className="h-3.5 w-3.5" />
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </ScrollArea>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ValidationList({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
        No validation issues.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {issues.map((issue, idx) => (
        <li
          key={`${issue.code}-${idx}`}
          className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
        >
          <SeverityBadge severity={issue.severity} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-mono text-[10px] text-muted-foreground">{issue.code}</span>
            <span>{issue.message}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SeverityBadge({ severity }: { severity: ValidationIssue["severity"] }) {
  const map = {
    info: "border-blue-400/30 text-blue-400",
    warning: "border-warning/40 text-warning",
    error: "border-destructive/40 text-destructive",
  } as const;
  return (
    <Badge variant="outline" className={`shrink-0 text-[10px] ${map[severity]}`}>
      {severity}
    </Badge>
  );
}
