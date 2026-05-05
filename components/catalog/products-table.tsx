"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { WidgetEmpty, WidgetError, WidgetSkeleton, WidgetStale } from "@/components/fallbacks";
import { RowErrorBoundary } from "@/components/resilience";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useInfiniteProductsQuery,
  useProductsQuery,
} from "@/hooks/use-products";
import { formatNumber, formatPrice, formatRelative } from "@/lib/format";
import type { Product, ProductFilter, ProductSort, ValidationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TableMode = "scroll" | "paginated";

const ROW_HEIGHT = 52;
const PAGE_SIZE = 200;

type CellMeta = { width?: number; numeric?: boolean };

function readMeta(col: { meta?: unknown }): CellMeta {
  return (col.meta as CellMeta | undefined) ?? {};
}

function flexStyle(width?: number): CSSProperties {
  return width ? { flex: `0 0 ${width}px`, width } : { flex: "1 1 0%", minWidth: 0 };
}

interface ProductsTableProps {
  filter: ProductFilter;
  sort: ProductSort;
  mode: TableMode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  killRowIds?: Set<string>;
}

export function ProductsTable(props: ProductsTableProps) {
  if (props.mode === "paginated") {
    return <PaginatedTable {...props} />;
  }
  return <ScrollTable {...props} />;
}

// --------------------------------------------------------------------- columns

function useColumns(killRowIds?: Set<string>) {
  return useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "validation",
        header: "",
        meta: { width: 40 } as CellMeta,
        cell: ({ row }) => <ValidationCell status={row.original.validationStatus} />,
      },
      {
        id: "name",
        header: "Product",
        cell: ({ row }) => <NameCell p={row.original} killRowIds={killRowIds} />,
      },
      {
        id: "brand",
        header: "Brand",
        meta: { width: 160 } as CellMeta,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.brand || "—"}</span>
        ),
      },
      {
        id: "category",
        header: "Category",
        meta: { width: 150 } as CellMeta,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px]">
            {row.original.category}
          </Badge>
        ),
      },
      {
        id: "price",
        header: "Price",
        meta: { width: 100, numeric: true } as CellMeta,
        cell: ({ row }) => (
          <span
            className={cn(
              "font-mono text-xs num",
              row.original.priceCents <= 0 && "text-destructive",
            )}
          >
            {formatPrice(row.original.priceCents)}
          </span>
        ),
      },
      {
        id: "inventory",
        header: "Inventory",
        meta: { width: 110, numeric: true } as CellMeta,
        cell: ({ row }) => (
          <span
            className={cn(
              "font-mono text-xs num",
              row.original.inventory === 0 && "text-warning",
            )}
          >
            {formatNumber(row.original.inventory)}
          </span>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        meta: { width: 220 } as CellMeta,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.slice(0, 3).map((t: string) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "updated",
        header: "Updated",
        meta: { width: 150 } as CellMeta,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelative(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [killRowIds],
  );
}

// --------------------------------------------------------------------- scroll table

function ScrollTable({ filter, sort, selectedId, onSelect, killRowIds }: ProductsTableProps) {
  const query = useInfiniteProductsQuery({ filter, sort, pageSize: PAGE_SIZE });

  const rows = useMemo<Product[]>(
    () => (query.data?.pages ?? []).flatMap((p) => p.rows),
    [query.data],
  );

  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const filteredTotal = lastPage?.filteredTotal ?? 0;
  const total = lastPage?.total ?? 0;
  const durationMs = lastPage?.durationMs ?? 0;

  const columns = useColumns(killRowIds);
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance < 600 && !query.isFetchingNextPage && query.hasNextPage) {
        query.fetchNextPage();
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [query]);

  if (query.isLoading) return <WidgetSkeleton variant="table" rows={12} className="p-4" />;
  if (query.isError) {
    return (
      <WidgetError
        title="Could not load products"
        error={query.error}
        technique="TanStack Query retry"
        onRetry={() => query.refetch()}
        className="m-4"
      />
    );
  }
  if (!rows.length) {
    return (
      <WidgetEmpty
        title="No products match"
        description="Try clearing some filters or widening the price range."
        className="m-4"
      />
    );
  }

  const showStale = query.isFetching && !query.isFetchingNextPage;

  return (
    <div role="table" aria-label="Products" className="flex h-full min-h-0 w-full flex-col">
      {showStale ? (
        <WidgetStale className="mx-4 mt-3" message="Refreshing while you keep scrolling…" />
      ) : null}
      <div ref={containerRef} className="w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <HeaderRows table={table} />
        <div
          role="rowgroup"
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = table.getRowModel().rows[virtualRow.index];
            if (!row) return null;
            return (
              <BodyRow
                key={row.id}
                row={row}
                top={virtualRow.start}
                selected={selectedId === row.original.id}
                onClick={() =>
                  onSelect(row.original.id === selectedId ? null : row.original.id)
                }
              />
            );
          })}
        </div>
      </div>
      <ScrollFooter
        loaded={rows.length}
        filtered={filteredTotal}
        total={total}
        durationMs={durationMs}
        loadingNext={query.isFetchingNextPage}
      />
    </div>
  );
}

// --------------------------------------------------------------------- paginated table

function PaginatedTable({
  filter,
  sort,
  selectedId,
  onSelect,
  killRowIds,
}: ProductsTableProps) {
  const [page, setPage] = useState(1);

  // Reset page when filter/sort changes.
  useEffect(() => {
    setPage(1);
  }, [filter, sort]);

  const query = useProductsQuery({ filter, sort, page, pageSize: PAGE_SIZE });
  const rows = query.data?.rows ?? [];
  const filteredTotal = query.data?.filteredTotal ?? 0;
  const total = query.data?.total ?? 0;
  const durationMs = query.data?.durationMs ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const columns = useColumns(killRowIds);
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (query.isLoading) return <WidgetSkeleton variant="table" rows={12} className="p-4" />;
  if (query.isError) {
    return (
      <WidgetError
        title="Could not load products"
        error={query.error}
        technique="TanStack Query retry"
        onRetry={() => query.refetch()}
        className="m-4"
      />
    );
  }

  const showStale = query.isFetching && query.isPlaceholderData;

  return (
    <div role="table" aria-label="Products" className="flex h-full min-h-0 w-full flex-col">
      {showStale ? <WidgetStale className="mx-4 mt-3" /> : null}
      <div className="w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <HeaderRows table={table} />
        {rows.length === 0 ? (
          <WidgetEmpty
            title="No products match"
            description="Try clearing some filters or widening the price range."
            className="m-4"
          />
        ) : (
          <div role="rowgroup" className="w-full">
            {table.getRowModel().rows.map((row) => (
              <BodyRow
                key={row.id}
                row={row}
                selected={selectedId === row.original.id}
                onClick={() =>
                  onSelect(row.original.id === selectedId ? null : row.original.id)
                }
              />
            ))}
          </div>
        )}
      </div>
      <PaginationFooter
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        filtered={filteredTotal}
        total={total}
        durationMs={durationMs}
        onChange={setPage}
      />
    </div>
  );
}

// --------------------------------------------------------------------- shared bits

function HeaderRows<T>({ table }: { table: ReturnType<typeof useReactTable<T>> }) {
  return (
    <div role="rowgroup" className="sticky top-0 z-10 w-full bg-background/95 backdrop-blur">
      {table.getHeaderGroups().map((hg) => (
        <div key={hg.id} role="row" className="flex w-full border-b border-border/60">
          {hg.headers.map((h) => {
            const meta = readMeta(h.column.columnDef);
            return (
              <div
                key={h.id}
                role="columnheader"
                style={flexStyle(meta.width)}
                className={cn(
                  "flex items-center px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
                  meta.numeric && "justify-end",
                )}
              >
                {h.isPlaceholder
                  ? null
                  : flexRender(h.column.columnDef.header, h.getContext())}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function BodyRow({
  row,
  top,
  selected,
  onClick,
}: {
  row: Row<Product>;
  top?: number;
  selected: boolean;
  onClick: () => void;
}) {
  const positioned = top !== undefined;
  const style: CSSProperties = positioned
    ? { height: ROW_HEIGHT, transform: `translateY(${top}px)` }
    : { height: ROW_HEIGHT };
  return (
    <div
      role="row"
      onClick={onClick}
      style={style}
      className={cn(
        "flex w-full cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/30",
        positioned && "absolute left-0 top-0",
        selected && "bg-accent/40",
      )}
    >
      <RowErrorBoundary rowId={row.original.id}>
        {row.getVisibleCells().map((cell) => {
          const meta = readMeta(cell.column.columnDef);
          return (
            <div
              key={cell.id}
              role="cell"
              style={flexStyle(meta.width)}
              className={cn(
                "flex items-center overflow-hidden px-3 py-2 text-sm",
                meta.numeric && "justify-end",
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          );
        })}
      </RowErrorBoundary>
    </div>
  );
}

function ValidationCell({ status }: { status: ValidationStatus }) {
  const map: Record<ValidationStatus, { icon: React.ReactNode; color: string; label: string }> = {
    ok: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-success", label: "ok" },
    warning: {
      icon: <CircleAlert className="h-3.5 w-3.5" />,
      color: "text-warning",
      label: "warn",
    },
    error: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      color: "text-destructive",
      label: "error",
    },
    unreviewed: {
      icon: <CircleDashed className="h-3.5 w-3.5" />,
      color: "text-muted-foreground",
      label: "—",
    },
  };
  const it = map[status];
  return (
    <span
      className={cn("flex items-center gap-1.5", it.color)}
      title={`Validation: ${it.label}`}
      aria-label={`validation status ${it.label}`}
    >
      {it.icon}
    </span>
  );
}

function NameCell({ p, killRowIds }: { p: Product; killRowIds?: Set<string> }) {
  if (killRowIds?.has(p.id)) {
    throw new Error("Lab-injected cell crash.");
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm">{p.name}</span>
      <span className="truncate text-[10px] font-mono text-muted-foreground">{p.sku}</span>
    </div>
  );
}

function ScrollFooter({
  loaded,
  filtered,
  total,
  durationMs,
  loadingNext,
}: {
  loaded: number;
  filtered: number;
  total: number;
  durationMs: number;
  loadingNext: boolean;
}) {
  const filteredOut = filtered !== total;
  return (
    <footer className="flex items-center justify-between border-t border-border/60 bg-background/80 px-4 py-2 text-[11px] text-muted-foreground">
      <span>
        Showing {formatNumber(loaded)} of {formatNumber(filtered)}
        {filteredOut ? <> (filtered from {formatNumber(total)})</> : null}
        {loadingNext ? <span className="ml-2 text-primary">· loading more…</span> : null}
      </span>
      <span className="font-mono">{durationMs.toFixed(1)} ms</span>
    </footer>
  );
}

function PaginationFooter({
  page,
  pageSize,
  totalPages,
  filtered,
  total,
  durationMs,
  onChange,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  filtered: number;
  total: number;
  durationMs: number;
  onChange: (page: number) => void;
}) {
  const start = filtered === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filtered);
  const filteredOut = filtered !== total;
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-background/80 px-4 py-2 text-[11px] text-muted-foreground">
      <span>
        {formatNumber(start)}–{formatNumber(end)} of {formatNumber(filtered)}
        {filteredOut ? <> (filtered from {formatNumber(total)})</> : null}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="font-mono text-[11px]">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <span className="ml-2 font-mono">filtered in {durationMs.toFixed(1)} ms</span>
      </div>
    </footer>
  );
}
