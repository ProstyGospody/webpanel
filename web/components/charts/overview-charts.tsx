import { useMemo } from "react";
import type { MouseEvent } from "react";

import { Card, CardContent, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";

import { EmptyState, LoadingState } from "@/components/ui/state-message";
import { formatRate } from "@/utils/format";

export type DashboardChartRange = "1h" | "24h";

export type SystemTrendSample = {
  timestamp: string;
  cpu_usage_percent: number;
  memory_used_percent: number;
  network_rx_bps: number;
  network_tx_bps: number;
};

type OverviewChartsProps = {
  loading: boolean;
  samples: SystemTrendSample[];
  range: DashboardChartRange;
  onRangeChange: (range: DashboardChartRange) => void;
};

type ChartPoint = {
  timestampMs: number;
  cpuUsagePercent: number;
  memoryUsedPercent: number;
  networkRxBps: number;
  networkTxBps: number;
};

type AxisValueFormatterContext = {
  location?: string;
  defaultTickLabel?: string;
};

type TimelineData = {
  xAxis: Date[];
  networkRx: Array<number | null>;
  networkTx: Array<number | null>;
  cpu: Array<number | null>;
  ram: Array<number | null>;
  filledBuckets: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HOUR_BUCKET_MS = 60 * 1000;
const DAY_BUCKET_MS = 10 * 60 * 1000;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function parseTimestamp(raw: string): number | null {
  const parsed = Date.parse(raw || "");
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    const date = Number.isFinite(numeric) && /^\d+$/.test(value.trim()) ? new Date(numeric) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTooltipClock(date: Date): string {
  return date.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatAxisTime(value: unknown, context?: AxisValueFormatterContext): string {
  const date = toDate(value);
  if (!date) {
    return typeof context?.defaultTickLabel === "string" ? context.defaultTickLabel : "";
  }

  if (context?.location === "tooltip") {
    return formatTooltipClock(date);
  }
  return formatClock(date);
}

function normalizePoints(samples: SystemTrendSample[], startMs: number, endMs: number): ChartPoint[] {
  return samples
    .map((sample) => {
      const timestampMs = parseTimestamp(sample.timestamp);
      if (timestampMs === null || timestampMs < startMs || timestampMs > endMs) {
        return null;
      }

      return {
        timestampMs,
        cpuUsagePercent: clampPercent(sample.cpu_usage_percent),
        memoryUsedPercent: clampPercent(sample.memory_used_percent),
        networkRxBps: Math.max(0, sample.network_rx_bps || 0),
        networkTxBps: Math.max(0, sample.network_tx_bps || 0),
      } as ChartPoint;
    })
    .filter((point): point is ChartPoint => point !== null)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function alignFloor(value: number, stepMs: number): number {
  return Math.floor(value / stepMs) * stepMs;
}

function alignCeil(value: number, stepMs: number): number {
  return Math.ceil(value / stepMs) * stepMs;
}

function buildTimeline(points: ChartPoint[], startMs: number, endMs: number, stepMs: number): TimelineData {
  const byBucket = new Map<number, ChartPoint>();
  for (const point of points) {
    const bucketTs = alignFloor(point.timestampMs, stepMs);
    if (bucketTs < startMs || bucketTs > endMs) {
      continue;
    }
    byBucket.set(bucketTs, point);
  }

  const xAxis: Date[] = [];
  const networkRx: Array<number | null> = [];
  const networkTx: Array<number | null> = [];
  const cpu: Array<number | null> = [];
  const ram: Array<number | null> = [];
  let filledBuckets = 0;

  for (let ts = startMs; ts <= endMs; ts += stepMs) {
    const point = byBucket.get(ts);
    xAxis.push(new Date(ts));
    if (point) {
      filledBuckets += 1;
      networkRx.push(point.networkRxBps);
      networkTx.push(point.networkTxBps);
      cpu.push(point.cpuUsagePercent);
      ram.push(point.memoryUsedPercent);
    } else {
      networkRx.push(null);
      networkTx.push(null);
      cpu.push(null);
      ram.push(null);
    }
  }

  return {
    xAxis,
    networkRx,
    networkTx,
    cpu,
    ram,
    filledBuckets,
  };
}

function chartStyleSx(theme: Theme) {
  return {
    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
      stroke: alpha(theme.palette.primary.main, 0.3),
    },
    "& .MuiChartsGrid-line": {
      stroke: alpha(theme.palette.primary.main, 0.16),
    },
    "& .MuiChartsAxis-tickLabel": {
      fill: alpha(theme.palette.text.primary, 0.92),
      fontSize: 11,
    },
    "& .MuiChartsLegend-label": {
      fill: theme.palette.text.primary,
      fontWeight: 600,
      fontSize: 12,
    },
    "& .MuiLineElement-root": {
      strokeWidth: 2.15,
    },
    "& .MuiAreaElement-root": {
      fillOpacity: 0.13,
    },
    "& .MuiAreaElement-series-download": {
      fillOpacity: 0.19,
    },
    "& .MuiAreaElement-series-upload": {
      fillOpacity: 0.11,
    },
    "& .MuiLineElement-series-upload": {
      strokeDasharray: "6 4",
    },
    "& .MuiChartsLegend-root": {
      display: "flex",
      justifyContent: "center",
    },
  };
}

export function OverviewCharts({ loading, samples, range, onRangeChange }: OverviewChartsProps) {
  const rangeMs = range === "24h" ? DAY_MS : HOUR_MS;
  const bucketMs = range === "24h" ? DAY_BUCKET_MS : HOUR_BUCKET_MS;
  const rangeEndMs = Date.now();
  const rangeStartMs = rangeEndMs - rangeMs;
  const alignedStartMs = alignFloor(rangeStartMs, bucketMs);
  const alignedEndMs = alignCeil(rangeEndMs, bucketMs);

  const timeline = useMemo(() => {
    const points = normalizePoints(samples, alignedStartMs, alignedEndMs);
    return buildTimeline(points, alignedStartMs, alignedEndMs, bucketMs);
  }, [samples, alignedStartMs, alignedEndMs, bucketMs]);

  const hasTrend = timeline.filledBuckets > 1;
  const xAxisTickNumber = range === "24h" ? 7 : 6;

  const handleRangeChange = (_event: MouseEvent<HTMLElement>, nextRange: DashboardChartRange | null) => {
    if (nextRange) {
      onRangeChange(nextRange);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Performance Charts</Typography>
        <ToggleButtonGroup
          exclusive
          value={range}
          onChange={handleRangeChange}
          size="small"
          sx={(theme) => ({
            border: `1px solid ${alpha(theme.palette.primary.main, 0.34)}`,
            borderRadius: 999,
            p: 0.35,
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            "& .MuiToggleButtonGroup-grouped": {
              border: 0,
              borderRadius: 999,
              px: 1.8,
              textTransform: "none",
              fontWeight: 700,
              color: theme.palette.text.secondary,
            },
            "& .MuiToggleButtonGroup-grouped.Mui-selected": {
              color: theme.palette.primary.contrastText,
              backgroundColor: theme.palette.primary.main,
            },
            "& .MuiToggleButtonGroup-grouped.Mui-selected:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          })}
        >
          <ToggleButton value="1h">1h</ToggleButton>
          <ToggleButton value="24h">24h</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6">Network</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading network trend..." minHeight={300} />
                ) : !hasTrend ? (
                  <EmptyState title="No network data yet" description="Real-time points will appear after automatic polling." minHeight={300} />
                ) : (
                  <LineChart
                    height={320}
                    margin={{ top: 34, right: 16, bottom: 40, left: 66 }}
                    colors={["#2EE2CD", "#FFC24D"]}
                    sx={chartStyleSx}
                    xAxis={[
                      {
                        data: timeline.xAxis,
                        scaleType: "time",
                        tickNumber: xAxisTickNumber,
                        valueFormatter: formatAxisTime,
                      },
                    ]}
                    yAxis={[
                      {
                        valueFormatter: (value: unknown) => formatRate(Number(value) || 0),
                      },
                    ]}
                    series={[
                      {
                        id: "download",
                        label: "Download",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: timeline.networkRx,
                        valueFormatter: (value: unknown) => (value === null ? "-" : formatRate(Number(value) || 0)),
                      },
                      {
                        id: "upload",
                        label: "Upload",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: timeline.networkTx,
                        valueFormatter: (value: unknown) => (value === null ? "-" : formatRate(Number(value) || 0)),
                      },
                    ]}
                    grid={{ horizontal: true, vertical: false }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6">CPU</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading CPU trend..." minHeight={270} />
                ) : !hasTrend ? (
                  <EmptyState title="No CPU data yet" description="Real-time points will appear after automatic polling." minHeight={270} />
                ) : (
                  <LineChart
                    height={290}
                    margin={{ top: 30, right: 16, bottom: 40, left: 54 }}
                    colors={["#4FA3FF"]}
                    sx={chartStyleSx}
                    xAxis={[
                      {
                        data: timeline.xAxis,
                        scaleType: "time",
                        tickNumber: xAxisTickNumber,
                        valueFormatter: formatAxisTime,
                      },
                    ]}
                    yAxis={[
                      {
                        min: 0,
                        max: 100,
                        valueFormatter: (value: unknown) => `${Math.max(0, Math.round(Number(value) || 0))}%`,
                      },
                    ]}
                    series={[
                      {
                        id: "cpu",
                        label: "CPU",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: timeline.cpu,
                        valueFormatter: (value: unknown) => (value === null ? "-" : `${clampPercent(Number(value) || 0).toFixed(1)}%`),
                      },
                    ]}
                    grid={{ horizontal: true, vertical: false }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6">RAM</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading RAM trend..." minHeight={270} />
                ) : !hasTrend ? (
                  <EmptyState title="No RAM data yet" description="Real-time points will appear after automatic polling." minHeight={270} />
                ) : (
                  <LineChart
                    height={290}
                    margin={{ top: 30, right: 16, bottom: 40, left: 54 }}
                    colors={["#58D98C"]}
                    sx={chartStyleSx}
                    xAxis={[
                      {
                        data: timeline.xAxis,
                        scaleType: "time",
                        tickNumber: xAxisTickNumber,
                        valueFormatter: formatAxisTime,
                      },
                    ]}
                    yAxis={[
                      {
                        min: 0,
                        max: 100,
                        valueFormatter: (value: unknown) => `${Math.max(0, Math.round(Number(value) || 0))}%`,
                      },
                    ]}
                    series={[
                      {
                        id: "ram",
                        label: "RAM",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: timeline.ram,
                        valueFormatter: (value: unknown) => (value === null ? "-" : `${clampPercent(Number(value) || 0).toFixed(1)}%`),
                      },
                    ]}
                    grid={{ horizontal: true, vertical: false }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
