"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ProductDetailPane } from "@/components/catalog/product-detail-pane";
import { ProductsTable, type TableMode } from "@/components/catalog/products-table";
import { CatalogToolbar } from "@/components/catalog/toolbar";
import type {
  EnrichmentStatus,
  ProductFilter,
  ProductSort,
  ReviewStatus,
  SortDirection,
  SortField,
  ValidationStatus,
} from "@/lib/types";

function readFromParams(params: URLSearchParams): {
  filter: ProductFilter;
  sort: ProductSort;
  mode: TableMode;
  selectedId: string | null;
} {
  return {
    filter: {
      search: params.get("q") || undefined,
      category: params.get("category"),
      brand: params.get("brand"),
      validationStatus: (params.get("vs") as ValidationStatus | null) || null,
      enrichmentStatus: (params.get("es") as EnrichmentStatus | null) || null,
      reviewStatus: (params.get("rs") as ReviewStatus | null) || null,
    },
    sort: {
      field: (params.get("sf") as SortField) || "name",
      direction: (params.get("sd") as SortDirection) || "asc",
    },
    mode: (params.get("mode") as TableMode) || "paginated",
    selectedId: params.get("sel"),
  };
}

function writeToParams(state: {
  filter: ProductFilter;
  sort: ProductSort;
  mode: TableMode;
  selectedId: string | null;
}): string {
  const qs = new URLSearchParams();
  if (state.filter.search) qs.set("q", state.filter.search);
  if (state.filter.category) qs.set("category", state.filter.category);
  if (state.filter.brand) qs.set("brand", state.filter.brand);
  if (state.filter.validationStatus) qs.set("vs", state.filter.validationStatus);
  if (state.filter.enrichmentStatus) qs.set("es", state.filter.enrichmentStatus);
  if (state.filter.reviewStatus) qs.set("rs", state.filter.reviewStatus);
  if (state.sort.field !== "name") qs.set("sf", state.sort.field);
  if (state.sort.direction !== "asc") qs.set("sd", state.sort.direction);
  if (state.mode !== "paginated") qs.set("mode", state.mode);
  if (state.selectedId) qs.set("sel", state.selectedId);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogInner />
    </Suspense>
  );
}

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(
    () => readFromParams(new URLSearchParams(searchParams?.toString())),
    [searchParams],
  );

  const [filter, setFilter] = useState<ProductFilter>(initial.filter);
  const [sort, setSort] = useState<ProductSort>(initial.sort);
  const [mode, setMode] = useState<TableMode>(initial.mode);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);

  // Sync state -> URL whenever any field changes.
  useEffect(() => {
    const qs = writeToParams({ filter, sort, mode, selectedId });
    router.replace(`/catalog${qs}`, { scroll: false });
  }, [filter, sort, mode, selectedId, router]);

  const onFilterChange = useCallback((f: ProductFilter) => {
    setFilter(f);
    setSelectedId(null);
  }, []);
  const onSortChange = useCallback((s: ProductSort) => {
    setSort(s);
  }, []);
  const onModeChange = useCallback((m: TableMode) => {
    setMode(m);
  }, []);

  return (
    <div className="relative flex h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden">
      <CatalogToolbar
        filter={filter}
        sort={sort}
        mode={mode}
        onFilter={onFilterChange}
        onSort={onSortChange}
        onModeChange={onModeChange}
      />
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <ProductsTable
          filter={filter}
          sort={sort}
          mode={mode}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <ProductDetailPane productId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
