"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { DashboardInterfaceRow } from "@/lib/dashboard/types";
import { formatBytes, formatDate, formatRate } from "@/lib/format";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const cpuChartConfig = {
  cpu: {
    label: "CPU",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const memoryChartConfig = {
  usage: {
    label: "RAM",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const networkChartConfig = {
  rxBps: {
    label: "RX",
    color: "hsl(var(--chart-2))",
  },
  txBps: {
    label: "TX",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

type CpuWindow = "15m" | "1h";

export default function DashboardPage() {
  const { data, loading, refreshing, error } = useDashboardMetrics();
  const [cpuWindow, setCpuWindow] = useState<CpuWindow>("15m");

  const cpu15mData = useMemo(
    () => (data?.cpu.window15m || []).map((point) => ({ timestamp: point.timestamp, cpu: point.value })),
    [data?.cpu.window15m]
  );

  const cpu1hData = useMemo(
    () => (data?.cpu.window1h || []).map((point) => ({ timestamp: point.timestamp, cpu: point.value })),
    [data?.cpu.window1h]
  );

  const memoryData = useMemo(
    () => (data?.memory.window1h || []).map((point) => ({ timestamp: point.timestamp, usage: point.value })),
    [data?.memory.window1h]
  );

  const networkData = useMemo(
    () =>
      (data?.network.window1h || []).map((point) => ({
        timestamp: point.timestamp,
        rxBps: point.rxBps,
        txBps: point.txBps,
      })),
    [data?.network.window1h]
  );

  const topError = error;
  const partialErrors = data?.partial ? data.errors : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live host telemetry from Prometheus + node_exporter, normalized by the Next.js BFF layer."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
              {refreshing ? "Refreshing" : "Live"}
            </Badge>
            <Badge variant="outline">Updated {formatDate(data?.generatedAt || null)}</Badge>
          </div>
        }
      />

      {topError && (
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{topError}</AlertDescription>
        </Alert>
      )}

      {!topError && partialErrors.length > 0 && (
        <Alert>
          <AlertTitle>Partial data</AlertTitle>
          <AlertDescription>{partialErrors.slice(0, 3).join(" | ")}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="summary-cards">
        <SummaryMetricCard
          title="CPU"
          value={formatPercent(data?.summary.cpuPercent)}
          description="Current utilization"
          icon={<Cpu className="size-4" />}
          loading={loading}
        />
        <SummaryMetricCard
          title="RAM"
          value={formatMemoryUsage(data?.summary.memoryUsedBytes, data?.summary.memoryTotalBytes)}
          description={`Used ${formatPercent(data?.summary.memoryUsagePercent)}`}
          icon={<MemoryStick className="size-4" />}
          loading={loading}
        />
        <SummaryMetricCard
          title="RX"
          value={formatRate(data?.summary.networkRxBps)}
          description="Ingress now"
          icon={<ArrowDownLeft className="size-4" />}
          loading={loading}
        />
        <SummaryMetricCard
          title="TX"
          value={formatRate(data?.summary.networkTxBps)}
          description="Egress now"
          icon={<ArrowUpRight className="size-4" />}
          loading={loading}
        />
      </section>

      <section className="space-y-4" aria-label="time-series">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>CPU usage</CardTitle>
                <CardDescription>15 minutes and 1 hour windows from node_cpu_seconds_total.</CardDescription>
              </div>
              <Tabs
                value={cpuWindow}
                onValueChange={(value) => setCpuWindow(value as CpuWindow)}
                className="w-full max-w-[260px]"
              >
                <TabsList variant="line" className="w-full">
                  <TabsTrigger value="15m" className="flex-1">
                    15m
                  </TabsTrigger>
                  <TabsTrigger value="1h" className="flex-1">
                    1h
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : (
              <Tabs value={cpuWindow} onValueChange={(value) => setCpuWindow(value as CpuWindow)} className="w-full">
                <TabsContent value="15m" className="m-0">
                  <SeriesAreaChart
                    data={cpu15mData}
                    config={cpuChartConfig}
                    dataKey="cpu"
                    valueFormatter={(value) => `${value.toFixed(1)}%`}
                    yTickFormatter={(value) => `${value}%`}
                  />
                </TabsContent>
                <TabsContent value="1h" className="m-0">
                  <SeriesAreaChart
                    data={cpu1hData}
                    config={cpuChartConfig}
                    dataKey="cpu"
                    valueFormatter={(value) => `${value.toFixed(1)}%`}
                    yTickFormatter={(value) => `${value}%`}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>RAM usage</CardTitle>
            <CardDescription>1 hour trend from MemAvailable / MemTotal.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : (
              <SeriesAreaChart
                data={memoryData}
                config={memoryChartConfig}
                dataKey="usage"
                valueFormatter={(value) => `${value.toFixed(1)}%`}
                yTickFormatter={(value) => `${value}%`}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Network throughput</CardTitle>
            <CardDescription>1 hour ingress/egress trend from node_network_*_bytes_total.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : (
              <NetworkLineChart data={networkData} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-label="bottom-metrics">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Network interfaces</CardTitle>
            <CardDescription>Per-interface RX/TX rates with errors and drops.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <InterfaceTable loading={loading} rows={data?.interfaces || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Host signals</CardTitle>
            <CardDescription>Load average and disk I/O snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {loading ? (
              <>
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </>
            ) : (
              <>
                <HostSignalRow
                  label="Load average"
                  value={`${formatLoad(data?.extras.load1)} / ${formatLoad(data?.extras.load5)} / ${formatLoad(data?.extras.load15)}`}
                  icon={<Activity className="size-4" />}
                />
                <HostSignalRow
                  label="Disk read"
                  value={formatRate(data?.extras.diskReadBps)}
                  icon={<HardDrive className="size-4" />}
                />
                <HostSignalRow
                  label="Disk write"
                  value={formatRate(data?.extras.diskWriteBps)}
                  icon={<Network className="size-4" />}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryMetricCard({
  title,
  value,
  description,
  icon,
  loading,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-[11px] font-semibold tracking-[0.08em] uppercase">{title}</CardDescription>
          <span className="text-muted-foreground">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? <Skeleton className="h-8 w-28 rounded-md" /> : <div className="text-2xl font-semibold tabular-nums">{value}</div>}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function SeriesAreaChart({
  data,
  config,
  dataKey,
  valueFormatter,
  yTickFormatter,
}: {
  data: Array<{ timestamp: string; [key: string]: string | number | null }>;
  config: ChartConfig;
  dataKey: string;
  valueFormatter: (value: number) => string;
  yTickFormatter: (value: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyChartState message="No samples available for this window." />;
  }

  return (
    <ChartContainer config={config} className="h-[280px] w-full aspect-auto">
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          minTickGap={36}
          tickFormatter={(value) => formatTimeTick(String(value))}
        />
        <YAxis
          width={56}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => yTickFormatter(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value) => {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                  return "-";
                }
                return valueFormatter(numeric);
              }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={`var(--color-${dataKey})`}
          fill={`var(--color-${dataKey})`}
          fillOpacity={0.18}
          strokeWidth={2}
          connectNulls
        />
      </AreaChart>
    </ChartContainer>
  );
}

function NetworkLineChart({ data }: { data: Array<{ timestamp: string; rxBps: number | null; txBps: number | null }> }) {
  if (data.length === 0) {
    return <EmptyChartState message="No network samples available for this window." />;
  }

  return (
    <ChartContainer config={networkChartConfig} className="h-[280px] w-full aspect-auto">
      <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          minTickGap={36}
          tickFormatter={(value) => formatTimeTick(String(value))}
        />
        <YAxis
          width={72}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatRate(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value) => {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                  return "-";
                }
                return formatRate(numeric);
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="rxBps"
          stroke="var(--color-rxBps)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="txBps"
          stroke="var(--color-txBps)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

function InterfaceTable({ loading, rows }: { loading: boolean; rows: DashboardInterfaceRow[] }) {
  if (loading) {
    return <Skeleton className="h-[260px] w-full rounded-lg" />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No interface metrics available.
      </div>
    );
  }

  return (
    <Table className="table-fixed min-w-[920px]">
      <colgroup>
        <col className="w-[16%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[8%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Interface</TableHead>
          <TableHead>RX</TableHead>
          <TableHead>TX</TableHead>
          <TableHead>RX errs/s</TableHead>
          <TableHead>TX errs/s</TableHead>
          <TableHead>RX drops/s</TableHead>
          <TableHead>TX drops/s</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.device}>
            <TableCell className="font-medium">{row.device}</TableCell>
            <TableCell className="tabular-nums">{formatRate(row.rxBps)}</TableCell>
            <TableCell className="tabular-nums">{formatRate(row.txBps)}</TableCell>
            <TableCell className="tabular-nums">{formatSmallRate(row.rxErrorsPerSec)}</TableCell>
            <TableCell className="tabular-nums">{formatSmallRate(row.txErrorsPerSec)}</TableCell>
            <TableCell className="tabular-nums">{formatSmallRate(row.rxDropsPerSec)}</TableCell>
            <TableCell className="tabular-nums">{formatSmallRate(row.txDropsPerSec)}</TableCell>
            <TableCell>
              <HealthBadge health={row.health} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HealthBadge({ health }: { health: DashboardInterfaceRow["health"] }) {
  if (health === "healthy") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        Healthy
      </Badge>
    );
  }

  if (health === "degraded") {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        Degraded
      </Badge>
    );
  }

  if (health === "critical") {
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
        Critical
      </Badge>
    );
  }

  return <Badge variant="outline">Unknown</Badge>;
}

function HostSignalRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

function formatMemoryUsage(used: number | null | undefined, total: number | null | undefined): string {
  if (used === null || used === undefined || total === null || total === undefined || total <= 0) {
    return "-";
  }
  return `${formatBytes(used)} / ${formatBytes(total)}`;
}

function formatSmallRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 1 ? 3 : 2,
  });
}

function formatLoad(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

function formatTimeTick(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
