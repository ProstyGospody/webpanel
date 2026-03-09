"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Cpu, MemoryStick } from "lucide-react";

import { apiFetch } from "@/lib/api";
import type { LiveDashboardPayload } from "@/lib/types";
import { formatBytes, formatDate, formatRate, formatUptime } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const POLL_INTERVAL_MS = 5000;
const HISTORY_LIMIT = 72;

type MetricSnapshot = {
  timestamp: number;
  cpu: number;
  memory: number;
  uptime: number;
  network: number;
};

type SeriesStats = {
  min: number;
  max: number;
  avg: number;
  current: number;
};

function appendSnapshot(history: MetricSnapshot[], snapshot: MetricSnapshot): MetricSnapshot[] {
  if (history.length > 0 && history[history.length - 1].timestamp === snapshot.timestamp) {
    return [...history.slice(0, -1), snapshot];
  }

  return [...history, snapshot].slice(-HISTORY_LIMIT);
}

function getSeriesStats(values: number[]): SeriesStats | null {
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    min,
    max,
    avg,
    current: values[values.length - 1],
  };
}

function buildSeriesPolyline(values: number[]): { line: string; area: string } {
  if (values.length === 0) {
    return { line: "", area: "" };
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? 100 : (index / (values.length - 1)) * 100;
    const y = 100 - ((value - minValue) / range) * 100;
    return `${x},${y}`;
  });

  const line = points.join(" ");
  const area = `0,100 ${line} 100,100`;

  return { line, area };
}

function formatWindowLabel(samples: number): string {
  if (samples <= 1) {
    return "Window: instant";
  }

  const duration = Math.max(0, (samples - 1) * (POLL_INTERVAL_MS / 1000));
  return `Window: ${formatUptime(duration)}`;
}

function formatTrend(values: number[], formatter: (delta: number) => string): string {
  if (values.length < 2) {
    return "Trend: waiting";
  }

  const start = values[0];
  const end = values[values.length - 1];
  const delta = end - start;

  if (Math.abs(delta) < 0.0001) {
    return "Trend: stable";
  }

  return `Trend: ${delta > 0 ? "up" : "down"} ${formatter(Math.abs(delta))}`;
}

function MetricChartCard({
  label,
  current,
  context,
  loading,
  failed,
  values,
  icon,
  valueFormatter,
  trendFormatter,
}: {
  label: string;
  current: string;
  context: string;
  loading: boolean;
  failed: boolean;
  values: number[];
  icon: ReactNode;
  valueFormatter: (value: number) => string;
  trendFormatter: (values: number[]) => string;
}) {
  const stats = getSeriesStats(values);
  const chart = buildSeriesPolyline(values);

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">{current}</CardTitle>
          <Badge variant="outline" className="text-[11px]">
            {trendFormatter(values)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{context}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && values.length === 0 ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : values.length === 0 ? (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            {failed ? "Data unavailable" : "Waiting for data"}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative h-56 overflow-hidden rounded-lg border border-border/70 bg-gradient-to-b from-muted/25 to-background">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <line x1="0" y1="0" x2="100" y2="0" className="stroke-border/50" strokeWidth="0.4" />
                <line x1="0" y1="50" x2="100" y2="50" className="stroke-border/50" strokeWidth="0.4" />
                <line x1="0" y1="100" x2="100" y2="100" className="stroke-border/50" strokeWidth="0.4" />

                <polygon points={chart.area} fill="hsl(var(--primary) / 0.14)" />
                <polyline
                  points={chart.line}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.8"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {stats && (
                <div className="pointer-events-none absolute right-2 top-2 space-y-1 rounded-md bg-background/80 px-2 py-1 text-[10px] text-muted-foreground shadow-sm ring-1 ring-border/60">
                  <div>max: {valueFormatter(stats.max)}</div>
                  <div>mid: {valueFormatter((stats.max + stats.min) / 2)}</div>
                  <div>min: {valueFormatter(stats.min)}</div>
                </div>
              )}

              {failed && <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">degraded source</span>}
            </div>

            {stats && (
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground">Min</p>
                  <p className="font-medium tabular-nums">{valueFormatter(stats.min)}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground">Average</p>
                  <p className="font-medium tabular-nums">{valueFormatter(stats.avg)}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground">Max</p>
                  <p className="font-medium tabular-nums">{valueFormatter(stats.max)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{formatWindowLabel(values.length)}</span>
              <span>Now</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<LiveDashboardPayload | null>(null);
  const [history, setHistory] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const payload = await apiFetch<LiveDashboardPayload>("/api/system/live");
      const backendIssues = (payload.errors || []).filter((issue, index, all) => issue && all.indexOf(issue) === index);

      setData(payload);
      setError(backendIssues.length > 0 ? backendIssues.join(". ") : null);
      setHistory((prev) =>
        appendSnapshot(prev, {
          timestamp: Date.parse(payload.collected_at) || Date.now(),
          cpu: payload.system.cpu_usage_percent,
          memory: payload.system.memory_used_percent,
          uptime: payload.system.uptime_seconds,
          network: (payload.system.network_rx_bps || 0) + (payload.system.network_tx_bps || 0),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    load(true).catch(() => {
      // handled in load
    });

    const timer = window.setInterval(() => {
      if (!cancelled) {
        load(false).catch(() => {
          // handled in load
        });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const system = data?.system;

  const cpuSeries = useMemo(() => history.map((point) => point.cpu), [history]);
  const memorySeries = useMemo(() => history.map((point) => point.memory), [history]);
  const uptimeSeries = useMemo(() => history.map((point) => point.uptime), [history]);
  const networkSeries = useMemo(() => history.map((point) => point.network), [history]);

  const hasHardFailure = Boolean(error && !data);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{refreshing ? "Refreshing" : "Live | 5s"}</Badge>
          <span>Updated: {formatDate(data?.collected_at)}</span>
        </div>
      </div>

      {error && (
        <Alert variant={hasHardFailure ? "destructive" : "default"}>
          <AlertTitle>{hasHardFailure ? "Dashboard unavailable" : "Partial data"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4" aria-label="System metrics">
        <MetricChartCard
          label="CPU"
          current={system ? `${system.cpu_usage_percent.toFixed(1)}%` : "--"}
          context={system ? `${system.source}${system.is_stale ? " | stale" : " | live"}` : "No sample yet"}
          loading={loading}
          failed={hasHardFailure}
          values={cpuSeries}
          valueFormatter={(value) => `${value.toFixed(1)}%`}
          trendFormatter={(values) => formatTrend(values, (delta) => `${delta.toFixed(1)} pp`) }
          icon={<Cpu className="size-4" />}
        />

        <MetricChartCard
          label="MEMORY"
          current={system ? `${system.memory_used_percent.toFixed(1)}%` : "--"}
          context={system ? `${formatBytes(system.memory_used_bytes)} of ${formatBytes(system.memory_total_bytes)}` : "No sample yet"}
          loading={loading}
          failed={hasHardFailure}
          values={memorySeries}
          valueFormatter={(value) => `${value.toFixed(1)}%`}
          trendFormatter={(values) => formatTrend(values, (delta) => `${delta.toFixed(1)} pp`) }
          icon={<MemoryStick className="size-4" />}
        />

        <MetricChartCard
          label="UPTIME"
          current={system ? formatUptime(system.uptime_seconds) : "--"}
          context={system ? `Collected: ${formatDate(system.collected_at)}` : "No sample yet"}
          loading={loading}
          failed={hasHardFailure}
          values={uptimeSeries}
          valueFormatter={(value) => formatUptime(value)}
          trendFormatter={(values) => formatTrend(values, (delta) => formatUptime(delta))}
          icon={<Clock3 className="size-4" />}
        />

        <MetricChartCard
          label="NETWORK"
          current={system ? formatRate((system.network_rx_bps || 0) + (system.network_tx_bps || 0)) : "--"}
          context={
            system
              ? `RX ${formatRate(system.network_rx_bps || 0)} | TX ${formatRate(system.network_tx_bps || 0)}`
              : "No sample yet"
          }
          loading={loading}
          failed={hasHardFailure}
          values={networkSeries}
          valueFormatter={(value) => formatRate(value)}
          trendFormatter={(values) => formatTrend(values, (delta) => formatRate(delta))}
          icon={<Activity className="size-4" />}
        />
      </section>
    </div>
  );
}
