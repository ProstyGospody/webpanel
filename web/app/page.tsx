"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Cpu,
  HardDrive,
  LayoutDashboard,
  MemoryStick,
  Network,
  RefreshCw,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { DashboardInterfaceRow } from "@/lib/dashboard/types";
import { formatDate, formatRate } from "@/lib/format";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    label: "Download",
    color: "hsl(var(--chart-2))",
  },
  txBps: {
    label: "Upload",
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
  const partialErrorItems = useMemo(() => partialErrors.slice(0, 3).map(formatPartialErrorMessage), [partialErrors]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        icon={<LayoutDashboard />}
        description="Server health and traffic overview."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
              {refreshing ? "Refreshing" : "Live"}
            </Badge>
            <Badge variant="outline">Updated {formatDate(data?.generatedAt || null)}</Badge>
          </div>
        }
      />

      {topError ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{topError}</AlertDescription>
        </Alert>
      ) : null}

      {!topError && partialErrors.length > 0 ? (
        <Alert>
          <AlertTitle>Partial data</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {partialErrorItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="summary-cards">
        <StatCard label="CPU" value={formatPercent(data?.summary.cpuPercent)} icon={<Cpu />} loading={loading} />
        <StatCard label="RAM" value={formatPercent(data?.summary.memoryUsagePercent)} icon={<MemoryStick />} loading={loading} />
        <StatCard label="Download" value={formatRate(data?.summary.networkRxBps)} icon={<ArrowDownLeft />} loading={loading} />
        <StatCard label="Upload" value={formatRate(data?.summary.networkTxBps)} icon={<ArrowUpRight />} loading={loading} />
      </section>

      <section className="space-y-4" aria-label="time-series">
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>CPU usage</CardTitle>
              <Tabs value={cpuWindow} onValueChange={(value) => setCpuWindow(value as CpuWindow)} className="w-full max-w-[220px]">
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
          <CardContent className="pt-3">
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
          <CardHeader className="border-b pb-3">
            <CardTitle>RAM usage</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
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
          <CardHeader className="border-b pb-3">
            <CardTitle>Network throughput</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">{loading ? <Skeleton className="h-[280px] w-full rounded-lg" /> : <NetworkLineChart data={networkData} />}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-label="bottom-metrics">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>Network interfaces</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <InterfaceTable loading={loading} rows={data?.interfaces || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>Host signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
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
                  icon={<Activity className="size-5" />}
                />
                <HostSignalRow label="Disk read" value={formatRate(data?.extras.diskReadBps)} icon={<HardDrive className="size-5" />} />
                <HostSignalRow label="Disk write" value={formatRate(data?.extras.diskWriteBps)} icon={<Network className="size-5" />} />
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
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
    return <EmptyChartState message="No data for this range." />;
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
        <YAxis width={56} tickLine={false} axisLine={false} tickFormatter={(value) => yTickFormatter(Number(value))} />
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
    return <EmptyChartState message="No network data for this range." />;
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
        <YAxis width={72} tickLine={false} axisLine={false} tickFormatter={(value) => formatRate(Number(value))} />
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
        <Line type="monotone" dataKey="rxBps" stroke="var(--color-rxBps)" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="txBps" stroke="var(--color-txBps)" strokeWidth={2} dot={false} connectNulls />
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
          <TableHead>Download</TableHead>
          <TableHead>Upload</TableHead>
          <TableHead>Download errs/s</TableHead>
          <TableHead>Upload errs/s</TableHead>
          <TableHead>Download drops/s</TableHead>
          <TableHead>Upload drops/s</TableHead>
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
    return <StatusBadge tone="success">Healthy</StatusBadge>;
  }

  if (health === "degraded") {
    return <StatusBadge tone="warning">Degraded</StatusBadge>;
  }

  if (health === "critical") {
    return <StatusBadge tone="danger">Critical</StatusBadge>;
  }

  return <StatusBadge tone="neutral">Unknown</StatusBadge>;
}

function HostSignalRow({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
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

function formatPartialErrorMessage(value: string): string {
  return value.replace(/^[a-z0-9-]+:\s*/i, "").trim() || "Data source unavailable";
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
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

