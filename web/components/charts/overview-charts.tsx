import { useMemo } from "react";
import type { MouseEvent } from "react";

import { Card, CardContent, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from "@mui/material";
import { alpha, type Theme, useTheme } from "@mui/material/styles";
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

type ParsedPoint = {
  timestampMs: number;
  cpu: number;
  ram: number;
  rx: number;
  tx: number;
};

type ChartPoint = {
  date: Date;
  cpu: number | null;
  ram: number | null;
  rx: number | null;
  tx: number | null;
};

type RangeConfig = {
  windowMs: number;
  stepMs: number;
  ticksDesktop: number;
  ticksMobile: number;
};

type PreparedChart = {
  points: ChartPoint[];
  startDate: Date;
  endDate: Date;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RANGE_CONFIG: Record<DashboardChartRange, RangeConfig> = {
  "1h": {
    windowMs: HOUR_MS,
    stepMs: 15 * 1000,
    ticksDesktop: 8,
    ticksMobile: 5,
  },
  "24h": {
    windowMs: DAY_MS,
    stepMs: 2 * 60 * 1000,
    ticksDesktop: 10,
    ticksMobile: 6,
  },
};

const NETWORK_AXIS_STEPS = [
  64 * 1024,
  128 * 1024,
  256 * 1024,
  512 * 1024,
  1024 * 1024,
  2 * 1024 * 1024,
  4 * 1024 * 1024,
  8 * 1024 * 1024,
  16 * 1024 * 1024,
  32 * 1024 * 1024,
  64 * 1024 * 1024,
  128 * 1024 * 1024,
  256 * 1024 * 1024,
  512 * 1024 * 1024,
  1024 * 1024 * 1024,
  2 * 1024 * 1024 * 1024,
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function parseSample(sample: SystemTrendSample): ParsedPoint | null {
  const timestampMs = Date.parse(sample.timestamp || "");
  if (Number.isNaN(timestampMs)) {
    return null;
  }

  return {
    timestampMs,
    cpu: clampPercent(sample.cpu_usage_percent),
    ram: clampPercent(sample.memory_used_percent),
    rx: Math.max(0, sample.network_rx_bps || 0),
    tx: Math.max(0, sample.network_tx_bps || 0),
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatTickTime(value: unknown, range: DashboardChartRange): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  const showSeconds = range === "1h";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: false,
  });
}

function formatRateAxisCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}G`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  return `${Math.round(value)}`;
}

function chartStyleSx(theme: Theme, compact: boolean) {
  return {
    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
      stroke: alpha(theme.palette.primary.main, 0.28),
    },
    "& .MuiChartsGrid-line": {
      stroke: alpha(theme.palette.primary.main, 0.16),
    },
    "& .MuiChartsAxis-tickLabel": {
      fill: alpha(theme.palette.text.primary, 0.92),
      fontSize: compact ? 10 : 11,
    },
    "& .MuiChartsLegend-label": {
      fill: theme.palette.text.primary,
      fontWeight: 600,
      fontSize: compact ? 11 : 12,
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

function buildPreparedChart(samples: SystemTrendSample[], range: DashboardChartRange): PreparedChart {
  const config = RANGE_CONFIG[range];
  const parsed = samples
    .map(parseSample)
    .filter((item): item is ParsedPoint => item !== null)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const nowAligned = Math.floor(Date.now() / config.stepMs) * config.stepMs;
  const latestMs = parsed.length ? parsed[parsed.length - 1].timestampMs : nowAligned;
  const endMs = Math.floor(latestMs / config.stepMs) * config.stepMs;

  const bucketCount = Math.floor(config.windowMs / config.stepMs) + 1;
  const startMs = endMs - (bucketCount - 1) * config.stepMs;

  const buckets = Array.from({ length: bucketCount }, () => ({
    count: 0,
    cpu: 0,
    ram: 0,
    rx: 0,
    tx: 0,
  }));

  for (const point of parsed) {
    if (point.timestampMs < startMs || point.timestampMs > endMs) {
      continue;
    }

    const index = Math.floor((point.timestampMs - startMs) / config.stepMs);
    if (index < 0 || index >= buckets.length) {
      continue;
    }

    const bucket = buckets[index];
    bucket.count += 1;
    bucket.cpu += point.cpu;
    bucket.ram += point.ram;
    bucket.rx += point.rx;
    bucket.tx += point.tx;
  }

  const points: ChartPoint[] = buckets.map((bucket, index) => {
    const date = new Date(startMs + index * config.stepMs);
    if (bucket.count === 0) {
      return {
        date,
        cpu: null,
        ram: null,
        rx: null,
        tx: null,
      };
    }

    return {
      date,
      cpu: bucket.cpu / bucket.count,
      ram: bucket.ram / bucket.count,
      rx: bucket.rx / bucket.count,
      tx: bucket.tx / bucket.count,
    };
  });

  return {
    points,
    startDate: new Date(startMs),
    endDate: new Date(endMs),
  };
}

function resolveNetworkAxisMax(points: ChartPoint[]): number {
  let peak = 0;
  for (const point of points) {
    if (point.rx !== null && point.rx > peak) {
      peak = point.rx;
    }
    if (point.tx !== null && point.tx > peak) {
      peak = point.tx;
    }
  }

  const target = Math.max(1, peak * 1.12);
  for (const step of NETWORK_AXIS_STEPS) {
    if (target <= step) {
      return step;
    }
  }

  const lastStep = NETWORK_AXIS_STEPS[NETWORK_AXIS_STEPS.length - 1];
  return Math.ceil(target / lastStep) * lastStep;
}

function hasEnoughTrendPoints(points: ChartPoint[]): boolean {
  let withData = 0;
  for (const point of points) {
    if (point.cpu !== null || point.ram !== null || point.rx !== null || point.tx !== null) {
      withData += 1;
      if (withData > 1) {
        return true;
      }
    }
  }
  return false;
}

export function OverviewCharts({ loading, samples, range, onRangeChange }: OverviewChartsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const rangeConfig = RANGE_CONFIG[range];

  const prepared = useMemo(() => buildPreparedChart(samples, range), [samples, range]);
  const hasTrend = useMemo(() => hasEnoughTrendPoints(prepared.points), [prepared.points]);
  const networkAxisMax = useMemo(() => resolveNetworkAxisMax(prepared.points), [prepared.points]);

  const xAxis = prepared.points.map((point) => point.date);
  const networkRx = prepared.points.map((point) => point.rx);
  const networkTx = prepared.points.map((point) => point.tx);
  const cpu = prepared.points.map((point) => point.cpu);
  const ram = prepared.points.map((point) => point.ram);

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

      <Grid container spacing={{ xs: 1.25, md: 2 }}>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.25, sm: 1.75 }, "&:last-child": { pb: { xs: 1.25, sm: 1.75 } } }}>
              <Stack spacing={1}>
                <Typography variant="h6">Network</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading network trend..." minHeight={isMobile ? 220 : 260} />
                ) : !hasTrend ? (
                  <EmptyState title="No network data yet" description="Real-time points will appear after automatic polling." minHeight={isMobile ? 220 : 260} />
                ) : (
                  <LineChart
                    skipAnimation
                    height={isMobile ? 248 : 286}
                    margin={{
                      top: isMobile ? 20 : 24,
                      right: isMobile ? 6 : 10,
                      bottom: isMobile ? 28 : 30,
                      left: isMobile ? 32 : 36,
                    }}
                    colors={["#2EE2CD", "#FFC24D"]}
                    sx={(chartTheme) => chartStyleSx(chartTheme, isMobile)}
                    xAxis={[
                      {
                        data: xAxis,
                        scaleType: "time",
                        tickNumber: isMobile ? rangeConfig.ticksMobile : rangeConfig.ticksDesktop,
                        min: prepared.startDate,
                        max: prepared.endDate,
                        tickLabelStyle: { fontSize: isMobile ? 10 : 11 },
                        valueFormatter: (value: unknown) => formatTickTime(value, range),
                      },
                    ]}
                    yAxis={[
                      {
                        width: isMobile ? 36 : 42,
                        min: 0,
                        max: networkAxisMax,
                        tickNumber: 5,
                        valueFormatter: (value: unknown) => formatRateAxisCompact(Number(value) || 0),
                      },
                    ]}
                    series={[
                      {
                        id: "download",
                        label: "Download",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: networkRx,
                        valueFormatter: (value: unknown) => formatRate(Number(value) || 0),
                      },
                      {
                        id: "upload",
                        label: "Upload",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: networkTx,
                        valueFormatter: (value: unknown) => formatRate(Number(value) || 0),
                      },
                    ]}
                    grid={{ horizontal: true, vertical: range === "24h" }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.25, sm: 1.75 }, "&:last-child": { pb: { xs: 1.25, sm: 1.75 } } }}>
              <Stack spacing={1}>
                <Typography variant="h6">CPU</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading CPU trend..." minHeight={isMobile ? 206 : 236} />
                ) : !hasTrend ? (
                  <EmptyState title="No CPU data yet" description="Real-time points will appear after automatic polling." minHeight={isMobile ? 206 : 236} />
                ) : (
                  <LineChart
                    skipAnimation
                    height={isMobile ? 228 : 246}
                    margin={{
                      top: isMobile ? 12 : 14,
                      right: isMobile ? 6 : 10,
                      bottom: isMobile ? 28 : 30,
                      left: isMobile ? 30 : 34,
                    }}
                    colors={["#4FA3FF"]}
                    sx={(chartTheme) => chartStyleSx(chartTheme, isMobile)}
                    xAxis={[
                      {
                        data: xAxis,
                        scaleType: "time",
                        tickNumber: isMobile ? rangeConfig.ticksMobile : rangeConfig.ticksDesktop,
                        min: prepared.startDate,
                        max: prepared.endDate,
                        tickLabelStyle: { fontSize: isMobile ? 10 : 11 },
                        valueFormatter: (value: unknown) => formatTickTime(value, range),
                      },
                    ]}
                    yAxis={[
                      {
                        width: isMobile ? 30 : 34,
                        min: 0,
                        max: 100,
                        tickNumber: 5,
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
                        data: cpu,
                        valueFormatter: (value: unknown) => `${clampPercent(Number(value) || 0).toFixed(1)}%`,
                      },
                    ]}
                    grid={{ horizontal: true, vertical: range === "24h" }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.25, sm: 1.75 }, "&:last-child": { pb: { xs: 1.25, sm: 1.75 } } }}>
              <Stack spacing={1}>
                <Typography variant="h6">RAM</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading RAM trend..." minHeight={isMobile ? 206 : 236} />
                ) : !hasTrend ? (
                  <EmptyState title="No RAM data yet" description="Real-time points will appear after automatic polling." minHeight={isMobile ? 206 : 236} />
                ) : (
                  <LineChart
                    skipAnimation
                    height={isMobile ? 228 : 246}
                    margin={{
                      top: isMobile ? 12 : 14,
                      right: isMobile ? 6 : 10,
                      bottom: isMobile ? 28 : 30,
                      left: isMobile ? 30 : 34,
                    }}
                    colors={["#58D98C"]}
                    sx={(chartTheme) => chartStyleSx(chartTheme, isMobile)}
                    xAxis={[
                      {
                        data: xAxis,
                        scaleType: "time",
                        tickNumber: isMobile ? rangeConfig.ticksMobile : rangeConfig.ticksDesktop,
                        min: prepared.startDate,
                        max: prepared.endDate,
                        tickLabelStyle: { fontSize: isMobile ? 10 : 11 },
                        valueFormatter: (value: unknown) => formatTickTime(value, range),
                      },
                    ]}
                    yAxis={[
                      {
                        width: isMobile ? 30 : 34,
                        min: 0,
                        max: 100,
                        tickNumber: 5,
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
                        data: ram,
                        valueFormatter: (value: unknown) => `${clampPercent(Number(value) || 0).toFixed(1)}%`,
                      },
                    ]}
                    grid={{ horizontal: true, vertical: range === "24h" }}
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
