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
  cpuUsagePercent: number;
  memoryUsedPercent: number;
  networkRxBps: number;
  networkTxBps: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) {
    return items;
  }

  const step = Math.ceil(items.length / maxPoints);
  return items.filter((_, index) => index % step === 0 || index === items.length - 1);
}

function asTimeLabel(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatClock(date);
}

function chartStyleSx(theme: Theme) {
  return {
    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
      stroke: alpha(theme.palette.primary.main, 0.28),
    },
    "& .MuiChartsGrid-line": {
      stroke: alpha(theme.palette.primary.main, 0.18),
    },
    "& .MuiChartsAxis-tickLabel": {
      fill: alpha(theme.palette.text.primary, 0.94),
      fontSize: 11,
    },
    "& .MuiChartsLegend-label": {
      fill: theme.palette.text.primary,
      fontWeight: 600,
      fontSize: 12,
    },
    "& .MuiLineElement-root": {
      strokeWidth: 2.2,
    },
    "& .MuiMarkElement-root": {
      strokeWidth: 2.1,
      fill: theme.palette.background.paper,
    },
    "& .MuiChartsLegend-root": {
      display: "flex",
      justifyContent: "center",
      "& .MuiChartsLegend-series": {
        gap: 8,
      },
    },
  };
}

export function OverviewCharts({ loading, samples, range, onRangeChange }: OverviewChartsProps) {
  const points = useMemo(() => {
    const rangeMs = range === "24h" ? DAY_MS : HOUR_MS;
    const cutoff = Date.now() - rangeMs;

    const prepared = samples
      .map((sample) => {
        const timestampMs = Date.parse(sample.timestamp);
        if (Number.isNaN(timestampMs)) {
          return null;
        }

        return {
          timestampMs,
          date: new Date(timestampMs),
          cpuUsagePercent: clampPercent(sample.cpu_usage_percent),
          memoryUsedPercent: clampPercent(sample.memory_used_percent),
          networkRxBps: Math.max(0, sample.network_rx_bps || 0),
          networkTxBps: Math.max(0, sample.network_tx_bps || 0),
        } as PreparedPoint;
      })
      .filter((point): point is PreparedPoint => point !== null)
      .filter((point) => point.timestampMs >= cutoff)
      .sort((a, b) => a.timestampMs - b.timestampMs);

    return downsample(prepared, range === "24h" ? 960 : 720);
  }, [samples, range]);

  const hasTrend = points.length > 1;
  const xAxisData = points.map((point) => point.date);

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
                    margin={{ top: 34, right: 16, bottom: 30, left: 66 }}
                    colors={["#00C9D8", "#59B8FF"]}
                    sx={chartStyleSx}
                    xAxis={[
                      {
                        data: xAxisData,
                        scaleType: "time",
                        valueFormatter: asTimeLabel,
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
                        area: false,
                        data: points.map((point) => point.networkRxBps),
                        valueFormatter: (value: unknown) => formatRate(Number(value) || 0),
                      },
                      {
                        id: "upload",
                        label: "Upload",
                        curve: "monotoneX",
                        showMark: false,
                        area: false,
                        data: points.map((point) => point.networkTxBps),
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
                    margin={{ top: 30, right: 16, bottom: 30, left: 54 }}
                    colors={["#65D8FF"]}
                    sx={chartStyleSx}
                    xAxis={[
                      {
                        data: xAxisData,
                        scaleType: "time",
                        valueFormatter: asTimeLabel,
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
                        area: false,
                        data: points.map((point) => point.cpuUsagePercent),
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
                    margin={{ top: 30, right: 16, bottom: 30, left: 54 }}
                    colors={["#67E0B5"]}
                    sx={chartStyleSx}
                    xAxis={[
                      {
                        data: xAxisData,
                        scaleType: "time",
                        valueFormatter: asTimeLabel,
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
                        area: false,
                        data: points.map((point) => point.memoryUsedPercent),
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
