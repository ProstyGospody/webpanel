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
const HISTORY_LIMIT = 48;

type MetricSnapshot = {
  timestamp: number;
  cpu: number;
  memory: number;
  uptime: number;
  network: number;
};

function appendSnapshot(history: MetricSnapshot[], snapshot: MetricSnapshot): MetricSnapshot[] {
  if (history.length > 0 && history[history.length - 1].timestamp === snapshot.timestamp) {
    return [...history.slice(0, -1), snapshot];
  }

  return [...history, snapshot].slice(-HISTORY_LIMIT);
}

function Sparkline({ values, loading, failed }: { values: number[]; loading: boolean; failed: boolean }) {
  if (loading && values.length === 0) {
    return <Skeleton className="h-20 w-full rounded-md" />;
  }

  if (values.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
        {failed ? "Data unavailable" : "Waiting for data"}
      </div>
    );
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 100 - ((value - minValue) / range) * 100;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(" ");
  const areaPoints = `0,100 ${polylinePoints} 100,100`;

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-md bg-muted/30">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polygon points={areaPoints} fill="hsl(var(--primary) / 0.16)" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.25"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {failed && <span className="absolute top-2 right-2 text-[10px] text-muted-foreground">degraded</span>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  loading,
  failed,
  values,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  loading: boolean;
  failed: boolean;
  values: number[];
  icon: ReactNode;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Sparkline values={values} loading={loading} failed={failed} />
        <p className="text-xs text-muted-foreground">{hint}</p>
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
          <Badge variant="outline">{refreshing ? "Refreshing" : "Live · 5s"}</Badge>
          <span>Updated: {formatDate(data?.collected_at)}</span>
        </div>
      </div>

      {error && (
        <Alert variant={hasHardFailure ? "destructive" : "default"}>
          <AlertTitle>{hasHardFailure ? "Dashboard unavailable" : "Partial data"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="System metrics">
        <MetricCard
          label="CPU"
          value={system ? `${system.cpu_usage_percent.toFixed(1)}%` : "--"}
          hint={system ? `${system.source}${system.is_stale ? " · stale" : " · live"}` : "No sample yet"}
          loading={loading}
          failed={hasHardFailure}
          values={cpuSeries}
          icon={<Cpu className="size-4" />}
        />

        <MetricCard
          label="MEMORY"
          value={system ? `${system.memory_used_percent.toFixed(1)}%` : "--"}
          hint={system ? `${formatBytes(system.memory_used_bytes)} of ${formatBytes(system.memory_total_bytes)}` : "No sample yet"}
          loading={loading}
          failed={hasHardFailure}
          values={memorySeries}
          icon={<MemoryStick className="size-4" />}
        />

        <MetricCard
          label="UPTIME"
          value={system ? formatUptime(system.uptime_seconds) : "--"}
          hint={system ? `Collected: ${formatDate(system.collected_at)}` : "No sample yet"}
          loading={loading}
          failed={hasHardFailure}
          values={uptimeSeries}
          icon={<Clock3 className="size-4" />}
        />

        <MetricCard
          label="NETWORK"
          value={system ? formatRate((system.network_rx_bps || 0) + (system.network_tx_bps || 0)) : "--"}
          hint={
            system
              ? `RX ${formatRate(system.network_rx_bps || 0)} · TX ${formatRate(system.network_tx_bps || 0)}`
              : "No sample yet"
          }
          loading={loading}
          failed={hasHardFailure}
          values={networkSeries}
          icon={<Activity className="size-4" />}
        />
      </section>
    </div>
  );
}




