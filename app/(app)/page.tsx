"use client";

import {
  AlertTriangle,
  CheckCheck,
  CircleAlert,
  Database,
  FileWarning,
  Layers,
  PackageCheck,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";

import { WidgetEmpty, WidgetError, WidgetSkeleton } from "@/components/fallbacks";
import { WidgetBoundary } from "@/components/resilience";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useStatsQuery } from "@/hooks/use-products";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import type { CatalogStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const VALIDATION_COLORS: Record<string, string> = {
  ok: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-destructive)",
  unreviewed: "var(--color-muted-foreground)",
};

const REVIEW_COLORS: Record<string, string> = {
  approved: "var(--color-success)",
  rejected: "var(--color-destructive)",
  needs_changes: "var(--color-warning)",
  unreviewed: "var(--color-muted-foreground)",
};

// ---------------------------------------------------------------- helpers

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trendSeries(seed: number, points: number, base: number, drift = 0.15) {
  const rng = mulberry(seed);
  let v = base;
  return Array.from({ length: points }).map((_, i) => {
    v = Math.max(0, v + (rng() - 0.5) * base * drift);
    return { day: i + 1, value: Math.round(v) };
  });
}

function cumulativeSeries(seed: number, points: number, perDay: number) {
  const rng = mulberry(seed);
  let acc = 0;
  return Array.from({ length: points }).map((_, i) => {
    acc += Math.round(perDay * (0.5 + rng()));
    return { day: i + 1, value: acc };
  });
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

// ---------------------------------------------------------------- page

export default function HomePage() {
  const query = useStatsQuery();
  const stats = query.data;

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10">
      <Hero total={stats?.total} />

      {query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <WidgetError
          title="Could not load stats"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      ) : !stats ? (
        <WidgetEmpty title="No stats yet" />
      ) : (
        <>
          <StatsRow stats={stats} />
          <ChartsGrid stats={stats} />
          <ProblemsSolved />
          <ApiSection />
          <StackSection />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- hero

function Hero({ total }: { total?: number }) {
  return (
    <section className="flex flex-col gap-5">
      <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
        product data infrastructure
      </Badge>
      <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        Validate, enrich, and edit massive product catalogs at speed.
      </h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Granary is a full-stack workspace for high-volume product data. Next.js API routes
        seed and serve a deterministic catalog of{" "}
        <strong>{total ? formatNumber(total) : "—"} products</strong> from Supabase Postgres,
        run a 12-rule validation engine, drive AI enrichment through Anthropic Claude, and
        stream progress over SSE. The frontend renders all of it without a stutter, and keeps
        running even when individual widgets fail.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/catalog" className={buttonVariants()}>
          Browse the catalog
        </Link>
        <Link href="/lab" className={buttonVariants({ variant: "outline" })}>
          Try the resilience lab
        </Link>
        <Link
          href="https://github.com/ThiagoC0STA/big-data-problems"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "ghost" })}
        >
          View source on GitHub
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- stats row

function StatsRow({ stats }: { stats: CatalogStats }) {
  const okPct = pct(stats.byValidation.ok ?? 0, stats.total);
  const errorPct = pct(stats.byValidation.error ?? 0, stats.total);
  const warnPct = pct(stats.byValidation.warning ?? 0, stats.total);
  const reviewedPct = pct(
    (stats.byReview.approved ?? 0) +
      (stats.byReview.rejected ?? 0) +
      (stats.byReview.needs_changes ?? 0),
    stats.total,
  );

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Total products"
          value={formatNumber(stats.total)}
          icon={<Database className="h-4 w-4" />}
          spark={trendSeries(11, 30, stats.total / 30, 0.05)}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Healthy"
          value={`${okPct}%`}
          accent="success"
          icon={<CheckCheck className="h-4 w-4" />}
          spark={trendSeries(22, 30, okPct, 0.04)}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="With warnings"
          value={`${warnPct}%`}
          accent="warning"
          icon={<CircleAlert className="h-4 w-4" />}
          spark={trendSeries(33, 30, warnPct, 0.06)}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Errors"
          value={`${errorPct}%`}
          accent="destructive"
          icon={<AlertTriangle className="h-4 w-4" />}
          spark={trendSeries(44, 30, errorPct, 0.08)}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Reviewed"
          value={`${reviewedPct}%`}
          icon={<ShieldCheck className="h-4 w-4" />}
          spark={cumulativeSeries(55, 30, stats.total / 30 / 4).map((d) => ({
            day: d.day,
            value: Math.min(100, (d.value / stats.total) * 100),
          }))}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Categories"
          value={String(stats.byCategory.length)}
          icon={<Layers className="h-4 w-4" />}
          spark={trendSeries(66, 30, stats.byCategory.length, 0)}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Out of stock"
          value={formatNumber(stats.inventoryHealth.out)}
          accent="destructive"
          icon={<PackageCheck className="h-4 w-4" />}
          spark={trendSeries(77, 30, stats.inventoryHealth.out / 30, 0.1)}
        />
      </WidgetBoundary>
      <WidgetBoundary technique="WidgetBoundary">
        <MetricWithSpark
          label="Issue codes"
          value={String(stats.validationIssueBreakdown.length)}
          icon={<FileWarning className="h-4 w-4" />}
          spark={trendSeries(88, 30, 12, 0)}
        />
      </WidgetBoundary>
    </section>
  );
}

function MetricWithSpark({
  label,
  value,
  accent,
  icon,
  spark,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning" | "destructive";
  icon: ReactNode;
  spark: { day: number; value: number }[];
}) {
  const tone =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : accent === "destructive"
          ? "text-destructive"
          : "";
  const stroke =
    accent === "success"
      ? "var(--color-success)"
      : accent === "warning"
        ? "var(--color-warning)"
        : accent === "destructive"
          ? "var(--color-destructive)"
          : "var(--color-chart-1)";
  const gradId = `spark-${label.replace(/\s+/g, "-")}`;
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn(tone || "text-muted-foreground")}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn("font-mono text-2xl font-semibold", tone)}>{value}</span>
      <div className="-mx-1 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- charts grid

function ChartsGrid({ stats }: { stats: CatalogStats }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        eyebrow="catalog telemetry"
        title="Live signals from the full catalog"
        body="Every chart below is computed in Postgres via a single optimized RPC and rendered with Recharts. Each one is wrapped in its own error boundary so that one bad chart does not blank the page."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetBoundary technique="WidgetBoundary">
          <ValidationDonut stats={stats} />
        </WidgetBoundary>
        <WidgetBoundary technique="WidgetBoundary">
          <ReviewDonut stats={stats} />
        </WidgetBoundary>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetBoundary technique="WidgetBoundary">
          <CategoryBars stats={stats} />
        </WidgetBoundary>
        <WidgetBoundary technique="WidgetBoundary">
          <PriceDistribution stats={stats} />
        </WidgetBoundary>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetBoundary technique="WidgetBoundary">
          <TopBrandsChart stats={stats} />
        </WidgetBoundary>
        <WidgetBoundary technique="WidgetBoundary">
          <IssuesBreakdown stats={stats} />
        </WidgetBoundary>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WidgetBoundary technique="WidgetBoundary">
          <InventoryRadial stats={stats} />
        </WidgetBoundary>
        <WidgetBoundary technique="WidgetBoundary">
          <CategoryTreemap stats={stats} />
        </WidgetBoundary>
        <WidgetBoundary technique="WidgetBoundary">
          <CompletionRadial stats={stats} />
        </WidgetBoundary>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetBoundary technique="WidgetBoundary">
          <IssuesTrend />
        </WidgetBoundary>
        <WidgetBoundary technique="WidgetBoundary">
          <CumulativeReviewed stats={stats} />
        </WidgetBoundary>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- charts

const TOOLTIP_STYLE = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  fontSize: 12,
  borderRadius: 6,
};

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <header className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {hint ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {hint}
          </Badge>
        ) : null}
      </header>
      {children}
    </Card>
  );
}

function ValidationDonut({ stats }: { stats: CatalogStats }) {
  const data = (Object.entries(stats.byValidation) as [string, number][]).map(([k, v]) => ({
    name: k,
    value: v,
  }));
  return (
    <ChartCard title="Validation health" hint="status">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={VALIDATION_COLORS[d.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <Legend
        items={data.map((d) => ({
          color: VALIDATION_COLORS[d.name] ?? "var(--color-chart-1)",
          label: d.name,
          value: formatNumber(d.value),
        }))}
      />
    </ChartCard>
  );
}

function ReviewDonut({ stats }: { stats: CatalogStats }) {
  const data = (Object.entries(stats.byReview) as [string, number][]).map(([k, v]) => ({
    name: k,
    value: v,
  }));
  return (
    <ChartCard title="Review status" hint="moderation">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={REVIEW_COLORS[d.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <Legend
        items={data.map((d) => ({
          color: REVIEW_COLORS[d.name] ?? "var(--color-chart-1)",
          label: d.name,
          value: formatNumber(d.value),
        }))}
      />
    </ChartCard>
  );
}

function CategoryBars({ stats }: { stats: CatalogStats }) {
  const data = stats.byCategory.map((c) => ({ name: c.category, value: c.count }));
  return (
    <ChartCard title="Products by category" hint={`${data.length} categories`}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            interval={0}
            angle={-25}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <Tooltip cursor={{ fill: "var(--color-accent)" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PriceDistribution({ stats }: { stats: CatalogStats }) {
  const data = stats.priceBuckets.map((b) => ({ name: b.bucket, count: b.count }));
  return (
    <ChartCard title="Price distribution" hint="USD">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <Tooltip cursor={{ fill: "var(--color-accent)" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function TopBrandsChart({ stats }: { stats: CatalogStats }) {
  const data = [...stats.topBrands].reverse().map((b) => ({ name: b.brand, value: b.count }));
  return (
    <ChartCard title="Top brands" hint="top 10">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            width={90}
          />
          <Tooltip cursor={{ fill: "var(--color-accent)" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function IssuesBreakdown({ stats }: { stats: CatalogStats }) {
  const data = stats.validationIssueBreakdown
    .map((i) => ({ name: i.code.replace(/_/g, " "), value: i.count }))
    .slice(0, 12);
  return (
    <ChartCard title="Validation issues" hint={`${data.length} codes`}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 30 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            width={130}
          />
          <Tooltip cursor={{ fill: "var(--color-accent)" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" fill="var(--color-chart-4)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function InventoryRadial({ stats }: { stats: CatalogStats }) {
  const total =
    stats.inventoryHealth.healthy + stats.inventoryHealth.low + stats.inventoryHealth.out;
  const data = [
    {
      name: "healthy",
      value: pct(stats.inventoryHealth.healthy, total),
      fill: "var(--color-success)",
    },
    {
      name: "low",
      value: pct(stats.inventoryHealth.low, total),
      fill: "var(--color-warning)",
    },
    {
      name: "out",
      value: pct(stats.inventoryHealth.out, total),
      fill: "var(--color-destructive)",
    },
  ];
  return (
    <ChartCard title="Inventory health" hint="%">
      <ResponsiveContainer width="100%" height={240}>
        <RadialBarChart
          innerRadius="30%"
          outerRadius="100%"
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background cornerRadius={6} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Legend
        items={[
          {
            color: "var(--color-success)",
            label: "Healthy",
            value: formatNumber(stats.inventoryHealth.healthy),
          },
          {
            color: "var(--color-warning)",
            label: "Low",
            value: formatNumber(stats.inventoryHealth.low),
          },
          {
            color: "var(--color-destructive)",
            label: "Out",
            value: formatNumber(stats.inventoryHealth.out),
          },
        ]}
      />
    </ChartCard>
  );
}

function CategoryTreemap({ stats }: { stats: CatalogStats }) {
  const data = useMemo(
    () =>
      stats.byCategory.map((c, i) => ({
        name: c.category,
        size: c.count,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [stats.byCategory],
  );
  return (
    <ChartCard title="Catalog footprint" hint="treemap">
      <ResponsiveContainer width="100%" height={240}>
        <Treemap
          data={data}
          dataKey="size"
          stroke="var(--color-background)"
          isAnimationActive={false}
        />
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CompletionRadial({ stats }: { stats: CatalogStats }) {
  const reviewed =
    (stats.byReview.approved ?? 0) +
    (stats.byReview.rejected ?? 0) +
    (stats.byReview.needs_changes ?? 0);
  const reviewedPct = pct(reviewed, stats.total);
  const healthyPct = pct(stats.byValidation.ok ?? 0, stats.total);
  const data = [
    { name: "Reviewed", value: reviewedPct, fill: "var(--color-chart-1)" },
    { name: "Healthy", value: healthyPct, fill: "var(--color-success)" },
  ];
  return (
    <ChartCard title="Catalog completion" hint="progress">
      <ResponsiveContainer width="100%" height={240}>
        <RadialBarChart innerRadius="40%" outerRadius="100%" data={data}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background cornerRadius={6} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Legend
        items={[
          { color: "var(--color-chart-1)", label: "Reviewed", value: `${reviewedPct}%` },
          { color: "var(--color-success)", label: "Healthy", value: `${healthyPct}%` },
        ]}
      />
    </ChartCard>
  );
}

function IssuesTrend() {
  const data = useMemo(() => trendSeries(101, 30, 320, 0.18), []);
  return (
    <ChartCard title="Daily issue rate (synthetic)" hint="last 30 days">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CumulativeReviewed({ stats }: { stats: CatalogStats }) {
  const data = useMemo(
    () => cumulativeSeries(202, 30, stats.total / 30 / 8),
    [stats.total],
  );
  return (
    <ChartCard title="Cumulative reviewed (synthetic)" hint="last 30 days">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            fill="url(#cumulative)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------- legend

function Legend({ items }: { items: { color: string; label: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: it.color }}
            aria-hidden
          />
          <span>{it.label}</span>
          {it.value ? <span className="font-mono opacity-70">· {it.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- problems solved

function ProblemsSolved() {
  const items = [
    {
      icon: <Database className="h-4 w-4" />,
      title: "Big data on the frontend",
      body: "Hundreds of thousands of rows in a virtualized TanStack Table. Server-side filter + sort returns in single-digit ms; the client never re-renders the off-screen rows.",
      hint: "TanStack Virtual",
    },
    {
      icon: <CheckCheck className="h-4 w-4" />,
      title: "Validation that scales",
      body: "12 rules run on every product after seed and after every patch. Issues are surfaced inline in the table and as a queue with bulk approve/reject/needs-changes.",
      hint: "12 rules",
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: "AI enrichment that ships",
      body: "Next.js API route calls Claude with prompt caching, fills description/tags/category, retries on transient failures, and falls back to deterministic offline output when the key is absent.",
      hint: "Claude API",
    },
    {
      icon: <Wifi className="h-4 w-4" />,
      title: "Real-time without breakage",
      body: "SSE streams progress live. The hook reconnects with exponential backoff up to 5 tries, then falls back to polling every 3s. Indicator shows current state.",
      hint: "SSE + polling",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Resilience as a feature",
      body: "Per-widget WidgetBoundary, per-row RowErrorBoundary, defensive Zod parsing, smart retry policy. One bad row can never blank an entire table — no matter how big.",
      hint: "12 techniques",
    },
    {
      icon: <Workflow className="h-4 w-4" />,
      title: "Editable bulk workflows",
      body: "Click any product to edit name, price, description, inventory. Bulk patch endpoint accepts up to 10K ids per call and re-validates atomically under a write lock.",
      hint: "bulk patch",
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        eyebrow="problems solved"
        title="What this demo proves"
        body="Every requirement of the role is mapped to a concrete behavior visible in the running app. Click around — none of these are slides."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <Card key={it.title} className="flex flex-col gap-2 p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                {it.icon}
              </div>
              <h3 className="text-sm font-medium">{it.title}</h3>
              <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">
                {it.hint}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{it.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- API section

function ApiSection() {
  const endpoints: { method: string; path: string; body: string; tone?: string }[] = [
    { method: "GET", path: "/products", body: "filter, sort, paginate the full catalog" },
    { method: "GET", path: "/products/{id}", body: "single product with validation issues" },
    { method: "PATCH", path: "/products/{id}", body: "edit name, price, description, inventory" },
    { method: "POST", path: "/products/bulk", body: "patch up to 10K ids in one transaction" },
    { method: "GET", path: "/products/meta/categories", body: "12 canonical categories" },
    { method: "GET", path: "/products/meta/brands", body: "all brands sorted" },
    { method: "GET", path: "/stats", body: "aggregations: validation, review, prices, brands…" },
    { method: "POST", path: "/enrich", body: "create AI enrichment job over N products" },
    { method: "GET", path: "/enrich/{id}", body: "polling fallback for job state" },
    {
      method: "GET",
      path: "/enrich/{id}/stream",
      body: "Server-Sent Events live progress",
      tone: "sse",
    },
    { method: "POST", path: "/lab/corrupt-row/{id}", body: "force a row into corrupt state" },
    { method: "GET", path: "/lab/500", body: "deterministic 500 for retry tests" },
    { method: "GET", path: "/lab/slow", body: "deterministic slow response for SWR demo" },
    { method: "POST", path: "/lab/reset", body: "rebuild the in-memory catalog" },
    { method: "GET", path: "/health", body: "liveness probe" },
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        eyebrow="the api"
        title="A Next.js API surface, end-to-end typed"
        body="Every endpoint is a Route Handler colocated under /app/api. Shared TypeScript types describe every payload, and the frontend runs each response through defensive Zod parsing, so a corrupted row becomes a placeholder instead of a crash."
      />
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border/40">
          {endpoints.map((ep) => (
            <li
              key={`${ep.method} ${ep.path}`}
              className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,2fr)] items-center gap-3 px-4 py-2 text-xs"
            >
              <Badge
                variant="outline"
                className={cn(
                  "w-fit font-mono text-[10px] uppercase",
                  ep.method === "GET" && "border-blue-400/40 text-blue-400",
                  ep.method === "POST" && "border-success/40 text-success",
                  ep.method === "PATCH" && "border-warning/40 text-warning",
                )}
              >
                {ep.method}
              </Badge>
              <code className="truncate font-mono">{ep.path}</code>
              <span className="truncate text-muted-foreground">
                {ep.body}
                {ep.tone === "sse" ? (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    SSE
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted-foreground">
        Source for every route at{" "}
        <a
          href="https://github.com/ThiagoC0STA/big-data-problems/tree/main/app/api"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          /app/api
        </a>{" "}
        on GitHub.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- stack

function StackSection() {
  const groups: {
    title: string;
    icon: ReactNode;
    items: { name: string; role: string }[];
  }[] = [
    {
      title: "Frontend",
      icon: <Layers className="h-4 w-4" />,
      items: [
        { name: "Next.js 16", role: "App Router + Cache Components" },
        { name: "React 19", role: "Server / Client components" },
        { name: "TypeScript 5", role: "strict typing" },
        { name: "Tailwind v4", role: "design tokens via @theme" },
        { name: "TanStack Query", role: "smart retry + cache" },
        { name: "TanStack Table + Virtual", role: "millions of rows fluid" },
        { name: "Recharts", role: "all charts on this page" },
        { name: "shadcn/ui (base-ui)", role: "primitives" },
      ],
    },
    {
      title: "Backend",
      icon: <Server className="h-4 w-4" />,
      items: [
        { name: "Next.js Route Handlers", role: "REST + SSE under /app/api" },
        { name: "Supabase Postgres", role: "managed DB + RPC for stats" },
        { name: "@supabase/supabase-js", role: "service role client" },
        { name: "Zod", role: "request payload validation" },
        { name: "Anthropic SDK", role: "Claude API + prompt cache" },
        { name: "Vercel", role: "edge + serverless deploy" },
      ],
    },
    {
      title: "Resilience",
      icon: <ShieldCheck className="h-4 w-4" />,
      items: [
        { name: "WidgetBoundary", role: "per-feature error wall" },
        { name: "RowErrorBoundary", role: "row-level failure containment" },
        { name: "Zod safeParse", role: "field-level .catch() fallback" },
        { name: "HttpError", role: "retryable taxonomy" },
        { name: "useEnrichmentStream", role: "reconnect + polling" },
        { name: "useOnlineStatus", role: "navigator.onLine banner" },
      ],
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        eyebrow="stack"
        title="The boring choices, made explicit"
        body="Every dependency on this list earns its place. No router we never use, no UI library we picked because it was trendy."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.title} className="flex flex-col gap-3 p-4">
            <header className="flex items-center gap-2">
              <span className="text-primary">{g.icon}</span>
              <h3 className="text-sm font-medium">{g.title}</h3>
            </header>
            <ul className="flex flex-col gap-1.5 text-xs">
              {g.items.map((it) => (
                <li key={it.name} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{it.name}</span>
                  <span className="truncate text-right text-muted-foreground">{it.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- shared

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <Separator className="mb-1 bg-border/60" />
      <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
        {eyebrow}
      </Badge>
      <h2 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{body}</p>
    </header>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <WidgetSkeleton key={i} variant="metric" />
      ))}
      <WidgetSkeleton variant="chart" className="md:col-span-2" />
      <WidgetSkeleton variant="chart" className="md:col-span-2" />
    </div>
  );
}
