import { useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { Card, CardContent, FormControl, Grid, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
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

type NetworkScaleMode = "absolute" | "percent";
type NetworkPaletteMode = "mui-material" | "mui-system" | "mui-x";

const NETWORK_PALETTES: Record<NetworkPaletteMode, { rx: string; tx: string; total: string }> = {
  "mui-material": { rx: "#4f63ff", tx: "#ffc531", total: "#ff5f78" },
  "mui-system": { rx: "#3bb6ff", tx: "#74da8f", total: "#ff9f47" },
  "mui-x": { rx: "#8268ff", tx: "#3dd9c0", total: "#ff6ca7" },
};

const chartCardSx = (theme: Theme) => ({
  position: "relative",
  overflow: "hidden",
  borderColor: alpha(theme.palette.primary.light, 0.32),
  backgroundColor: alpha(theme.palette.background.paper, 0.78),
  backgroundImage: [
    `radial-gradient(circle at 14% 10%, ${alpha("#1f7fff", 0.18)} 0%, transparent 52%)`,
    `radial-gradient(circle at 88% 2%, ${alpha("#54b9ff", 0.14)} 0%, transparent 42%)`,
    `linear-gradient(180deg, ${alpha("#071428", 0.96)} 0%, ${alpha("#050f1f", 0.98)} 100%)`,
  ].join(","),
  "&::before": {
    content: "\"\"",
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.06)}`,
  },
});

const chartCanvasSx = {
  "& .MuiLineElement-root": {
    strokeWidth: 2.2,
  },
  "& .MuiAreaElement-root": {
    fillOpacity: 0.17,
  },
};

const selectSx = (theme: Theme) => ({
  minWidth: 180,
  "& .MuiOutlinedInput-root": {
    borderRadius: 12,
    backgroundColor: alpha(theme.palette.background.default, 0.62),
  },
});

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

export function OverviewCharts({ loading, samples, range, onRangeChange }: OverviewChartsProps) {
  const [networkScaleMode, setNetworkScaleMode] = useState<NetworkScaleMode>("absolute");
  const [networkPaletteMode, setNetworkPaletteMode] = useState<NetworkPaletteMode>("mui-material");

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
  const networkPalette = NETWORK_PALETTES[networkPaletteMode];

  const networkPeak = useMemo(() => {
    if (points.length === 0) {
      return 1;
    }
    return points.reduce((maxValue, point) => {
      const total = point.networkRxBps + point.networkTxBps;
      return Math.max(maxValue, point.networkRxBps, point.networkTxBps, total);
    }, 1);
  }, [points]);

  const networkSeriesData = useMemo(() => {
    const toScale = (value: number): number => {
      if (networkScaleMode === "percent") {
        return (value / networkPeak) * 100;
      }
      return value;
    };

    return {
      rx: points.map((point) => toScale(point.networkRxBps)),
      tx: points.map((point) => toScale(point.networkTxBps)),
      total: points.map((point) => toScale(point.networkRxBps + point.networkTxBps)),
    };
  }, [networkPeak, networkScaleMode, points]);

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
          <Card sx={(theme) => ({ ...chartCardSx(theme), height: "100%" })}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.75}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                  <FormControl size="small" sx={(theme) => selectSx(theme)}>
                    <Select value={networkPaletteMode} onChange={(event) => setNetworkPaletteMode(event.target.value as NetworkPaletteMode)}>
                      <MenuItem value="mui-material">@mui/material</MenuItem>
                      <MenuItem value="mui-system">@mui/system</MenuItem>
                      <MenuItem value="mui-x">@mui/x-charts</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={(theme) => ({ ...selectSx(theme), minWidth: 150 })}>
                    <Select value={networkScaleMode} onChange={(event) => setNetworkScaleMode(event.target.value as NetworkScaleMode)}>
                      <MenuItem value="absolute">Absolute</MenuItem>
                      <MenuItem value="percent">Percent</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading network trend..." minHeight={300} />
                ) : !hasTrend ? (
                  <EmptyState title="No network data yet" description="Real-time points will appear after automatic polling." minHeight={300} />
                ) : (
                  <LineChart
                    sx={chartCanvasSx}
                    colors={[networkPalette.rx, networkPalette.tx, networkPalette.total]}
                    height={420}
                    margin={{ top: 28, right: 18, bottom: 36, left: 66 }}
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
                        valueFormatter: (value) =>
                          networkScaleMode === "percent"
                            ? `${Math.max(0, Math.round(Number(value) || 0))}%`
                            : formatRate(Number(value) || 0),
                      },
                    ]}
                    series={[
                      {
                        id: "download",
                        label: "RX",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: networkSeriesData.rx,
                        valueFormatter: (value) =>
                          networkScaleMode === "percent"
                            ? `${clampPercent(Number(value) || 0).toFixed(1)}%`
                            : formatRate(Number(value) || 0),
                      },
                      {
                        id: "upload",
                        label: "TX",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: networkSeriesData.tx,
                        valueFormatter: (value) =>
                          networkScaleMode === "percent"
                            ? `${clampPercent(Number(value) || 0).toFixed(1)}%`
                            : formatRate(Number(value) || 0),
                      },
                      {
                        id: "total",
                        label: "TOTAL",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: networkSeriesData.total,
                        valueFormatter: (value) =>
                          networkScaleMode === "percent"
                            ? `${clampPercent(Number(value) || 0).toFixed(1)}%`
                            : formatRate(Number(value) || 0),
                      },
                    ]}
                    grid={{ horizontal: true }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={(theme) => ({ ...chartCardSx(theme), height: "100%" })}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="h6">CPU</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading CPU trend..." minHeight={270} />
                ) : !hasTrend ? (
                  <EmptyState title="No CPU data yet" description="Real-time points will appear after automatic polling." minHeight={270} />
                ) : (
                  <LineChart
                    sx={chartCanvasSx}
                    colors={["#4f63ff"]}
                    height={290}
                    margin={{ top: 18, right: 16, bottom: 30, left: 54 }}
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
                        valueFormatter: (value) => `${Math.max(0, Math.round(Number(value) || 0))}%`,
                      },
                    ]}
                    series={[
                      {
                        id: "cpu",
                        label: "CPU",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: points.map((point) => point.cpuUsagePercent),
                        valueFormatter: (value) => `${clampPercent(Number(value) || 0).toFixed(1)}%`,
                      },
                    ]}
                    grid={{ horizontal: true }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={(theme) => ({ ...chartCardSx(theme), height: "100%" })}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="h6">RAM</Typography>
                {loading && !hasTrend ? (
                  <LoadingState message="Loading RAM trend..." minHeight={270} />
                ) : !hasTrend ? (
                  <EmptyState title="No RAM data yet" description="Real-time points will appear after automatic polling." minHeight={270} />
                ) : (
                  <LineChart
                    sx={chartCanvasSx}
                    colors={["#ffc531"]}
                    height={290}
                    margin={{ top: 18, right: 16, bottom: 30, left: 54 }}
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
                        valueFormatter: (value) => `${Math.max(0, Math.round(Number(value) || 0))}%`,
                      },
                    ]}
                    series={[
                      {
                        id: "ram",
                        label: "RAM",
                        curve: "monotoneX",
                        showMark: false,
                        area: true,
                        data: points.map((point) => point.memoryUsedPercent),
                        valueFormatter: (value) => `${clampPercent(Number(value) || 0).toFixed(1)}%`,
                      },
                    ]}
                    grid={{ horizontal: true }}
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
