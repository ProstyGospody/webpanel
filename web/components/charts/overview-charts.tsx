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

type PreparedPoint = {
  timestampMs: number;
  date: Date;
  cpu: number;
  ram: number;
  rx: number;
  tx: number;
};

type AxisContext = {
  location?: string;
  defaultTickLabel?: string;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function parsePoint(sample: SystemTrendSample): PreparedPoint | null {
  const timestampMs = Date.parse(sample.timestamp || "");
  if (Number.isNaN(timestampMs)) {
    return null;
  }

  return {
    timestampMs,
    date: new Date(timestampMs),
    cpu: clampPercent(sample.cpu_usage_percent),
    ram: clampPercent(sample.memory_used_percent),
    rx: Math.max(0, sample.network_rx_bps || 0),
    tx: Math.max(0, sample.network_tx_bps || 0),
  };
}

function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) {
    return items;
  }
  const step = Math.ceil(items.length / maxPoints);
  return items.filter((_, index) => index % step === 0 || index === items.length - 1);
}

function formatAxisTime(value: unknown, context?: AxisContext): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : typeof value === "string"
          ? new Date(value)
          : null;

  if (!date || Number.isNaN(date.getTime())) {
    return typeof context?.defaultTickLabel === "string" ? context.defaultTickLabel : "";
  }

  if (context?.location === "tooltip") {
    return date.toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function chartStyleSx(theme: Theme) {
  return {
    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
      stroke: alpha(theme.palette.primary.main, 0.28),
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
  const maxPoints = range === "24h" ? 480 : 360;
  const xTicks = range === "24h" ? 8 : 6;
  const rangeEndMs = Date.now();
  const rangeStartMs = rangeEndMs - rangeMs;
  const rangeStartDate = new Date(rangeStartMs);
  const rangeEndDate = new Date(rangeEndMs);

  const points = useMemo(() => {
    const filtered = samples
      .map(parsePoint)
      .filter((point): point is PreparedPoint => point !== null)
      .filter((point) => point.timestampMs >= rangeStartMs && point.timestampMs <= rangeEndMs)
      .sort((a, b) => a.timestampMs - b.timestampMs);

    if (filtered.length > 0 && filtered[0].timestampMs > rangeStartMs) {
      const first = filtered[0];
      filtered.unshift({
        ...first,
        timestampMs: rangeStartMs,
        date: new Date(rangeStartMs),
      });
    }

    return downsample(filtered, maxPoints);
  }, [samples, rangeStartMs, rangeEndMs, maxPoints]);

  const hasTrend = points.length > 1;

  const xAxis = points.map((point) => point.date);
  const networkRx = points.map((point) => point.rx);
  const networkTx = points.map((point) => point.tx);
  const cpu = points.map((point) => point.cpu);
  const ram = points.map((point) => point.ram);

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
                        data: xAxis,
                        scaleType: "time",
                        tickNumber: xTicks,
                        min: rangeStartDate,
                        max: rangeEndDate,
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
                        data: xAxis,
                        scaleType: "time",
                        tickNumber: xTicks,
                        min: rangeStartDate,
                        max: rangeEndDate,
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
                        data: cpu,
                        valueFormatter: (value: unknown) => `${clampPercent(Number(value) || 0).toFixed(1)}%`,
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
                        data: xAxis,
                        scaleType: "time",
                        tickNumber: xTicks,
                        min: rangeStartDate,
                        max: rangeEndDate,
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
                        data: ram,
                        valueFormatter: (value: unknown) => `${clampPercent(Number(value) || 0).toFixed(1)}%`,
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
