"use client";

import { Download, List, MoveVertical, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { TableMode } from "@/components/catalog/products-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBrandsQuery, useCategoriesQuery } from "@/hooks/use-products";
import { exportProductsUrl } from "@/lib/api-client";
import type { ProductFilter, ProductSort, ValidationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  filter: ProductFilter;
  sort: ProductSort;
  mode: TableMode;
  onFilter: (next: ProductFilter) => void;
  onSort: (next: ProductSort) => void;
  onModeChange: (mode: TableMode) => void;
}

const VALIDATION_OPTIONS: { value: ValidationStatus | "any"; label: string }[] = [
  { value: "any", label: "Any validation" },
  { value: "ok", label: "OK" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "unreviewed", label: "Unreviewed" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "name:asc", label: "Name (A→Z)" },
  { value: "name:desc", label: "Name (Z→A)" },
  { value: "priceCents:asc", label: "Price (low → high)" },
  { value: "priceCents:desc", label: "Price (high → low)" },
  { value: "inventory:asc", label: "Inventory (low → high)" },
  { value: "inventory:desc", label: "Inventory (high → low)" },
  { value: "updatedAt:desc", label: "Recently updated" },
];

export function CatalogToolbar({
  filter,
  sort,
  mode,
  onFilter,
  onSort,
  onModeChange,
}: ToolbarProps) {
  const [searchInput, setSearchInput] = useState(filter.search ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== (filter.search ?? "")) {
        onFilter({ ...filter, search: next || undefined });
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const cats = useCategoriesQuery();
  const brands = useBrandsQuery();

  const sortValue = `${sort.field}:${sort.direction}`;
  const activeFilterChips: string[] = [];
  if (filter.category) activeFilterChips.push(`category: ${filter.category}`);
  if (filter.brand) activeFilterChips.push(`brand: ${filter.brand}`);
  if (filter.validationStatus) activeFilterChips.push(`validation: ${filter.validationStatus}`);

  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-background/95 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, SKU, brand…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
            aria-label="Search products"
          />
          {searchInput ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <Select
          value={filter.category ?? "any"}
          onValueChange={(v) => onFilter({ ...filter, category: v === "any" ? null : v })}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any category</SelectItem>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.brand ?? "any"}
          onValueChange={(v) => onFilter({ ...filter, brand: v === "any" ? null : v })}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by brand">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any brand</SelectItem>
            {(brands.data ?? []).map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.validationStatus ?? "any"}
          onValueChange={(v) =>
            onFilter({
              ...filter,
              validationStatus: v === "any" ? null : (v as ValidationStatus),
            })
          }
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by validation status">
            <SelectValue placeholder="Validation" />
          </SelectTrigger>
          <SelectContent>
            {VALIDATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortValue}
          onValueChange={(v) => {
            if (!v) return;
            const [field, direction] = v.split(":") as [
              ProductSort["field"],
              ProductSort["direction"],
            ];
            onSort({ field, direction });
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Sort">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <div
            role="tablist"
            aria-label="View mode"
            className="flex rounded-lg border border-border/60 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "scroll"}
              onClick={() => onModeChange("scroll")}
              className={cn(
                "flex h-6 items-center gap-1 rounded-md px-2 text-[11px] transition-colors",
                mode === "scroll"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoveVertical className="h-3 w-3" />
              Scroll
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "paginated"}
              onClick={() => onModeChange("paginated")}
              className={cn(
                "flex h-6 items-center gap-1 rounded-md px-2 text-[11px] transition-colors",
                mode === "paginated"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3 w-3" />
              Pages
            </button>
          </div>
          <a
            href={exportProductsUrl(filter, sort)}
            download="granary-catalog.csv"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Export filtered catalog as CSV"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </a>
        </div>
      </div>

      {activeFilterChips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <Badge key={chip} variant="secondary" className="text-[10px]">
              {chip}
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() =>
              onFilter({
                ...filter,
                category: null,
                brand: null,
                validationStatus: null,
              })
            }
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
