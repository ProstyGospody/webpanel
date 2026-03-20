"use client";

import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
  Alert,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { LoadingState } from "@/components/ui/state-message";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { HysteriaOverview, SystemLiveResponse } from "@/types/common";
import { formatBytes, formatDateTime, formatRate, formatUptime } from "@/utils/format";

type HysteriaHistoryItem = {
  id: number;
  hysteria_user_id: string;
  tx_bytes: number;
  rx_bytes: number;
  online_count: number;
  snapshot_at: string;
};

type TrafficHistoryPoint = {
  at: number;
  txBytes: number;
  rxBytes: number;
  onlineCount: number;
};

type LiveSamplePoint = {
  at: number;
  rxBps: number;
  txBps: number;
  tcpPackets: number;
  udpPackets: number;
  tcpPps: number;
  udpPps: number;
  totalTxBytes: number;
  totalRxBytes: number;
  onlineCount: number;
};

const MAX_LIVE_POINTS = 64;
const HISTORY_LIMIT = 900;

function isHealthyStatus(status: string): boolean {
  const value = (status || "").toLowerCase();
  return value.includes("active") || value.includes("running") || value.includes("enabled");
}

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed);
  }
  return new Date(0);
}

function formatTimeTick(value: unknown): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function aggregateTrafficHistory(items: HysteriaHistoryItem[]): TrafficHistoryPoint[] {
  const bucket = new Map<number, TrafficHistoryPoint>();
  for (const item of items) {
    const timestamp = Date.parse(item.snapshot_at);
    if (Number.isNaN(timestamp)) {
      continue;
    }
    const current = bucket.get(timestamp) || { at: timestamp, txBytes: 0, rxBytes: 0, onlineCount: 0 };
    current.txBytes += item.tx_bytes || 0;
    current.rxBytes += item.rx_bytes || 0;
    current.onlineCount += item.online_count || 0;
    bucket.set(timestamp, current);
  }
  return Array.from(bucket.values())
    .sort((a, b) => a.at - b.at)
    .slice(-72);
}

function trendFromSeries(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) {
    return "flat";
  }
  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  if (!Number.isFinite(latest) || !Number.isFinite(prev)) {
    return "flat";
  }
  const delta = latest - prev;
  if (Math.abs(delta) < Math.max(1, prev * 0.03)) {
    return "flat";
  }
  return delta > 0 ? "up" : "down";
}

function pushLivePoint(
  current: LiveSamplePoint[],
  live: SystemLiveResponse,
  overview: HysteriaOverview | null,
): LiveSamplePoint[] {
  const at = Date.parse(live.collected_at || live.system.collected_at) || Date.now();
  const nextPoint: LiveSamplePoint = {
    at,
    rxBps: live.system.network_rx_bps || 0,
    txBps: live.system.network_tx_bps || 0,
    tcpPackets: live.system.tcp_packets || 0,
    udpPackets: live.system.udp_packets || 0,
    tcpPps: live.system.tcp_packets_per_sec || 0,
    udpPps: live.system.udp_packets_per_sec || 0,
    totalTxBytes: overview?.total_tx_bytes ?? live.hysteria.total_tx_bytes ?? 0,
    totalRxBytes: overview?.total_rx_bytes ?? live.hysteria.total_rx_bytes ?? 0,
    onlineCount: overview?.online_count ?? live.hysteria.online_count ?? 0,
  };
  const merged = [...current, nextPoint];
  return merged.slice(-MAX_LIVE_POINTS);
}

export default function DashboardPage() {
  const theme = useTheme();
  const [live, setLive] = useState<SystemLiveResponse | null>(null);
  const [overview, setOverview] = useState<HysteriaOverview | null>(null);
  const [history, setHistory] = useState<TrafficHistoryPoint[]>([]);
  const [livePoints, setLivePoints] = useState<LiveSamplePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (withHistory: boolean) => {
    setError("");
    try {
      const [livePayload, overviewPayload] = await Promise.all([
        apiFetch<SystemLiveResponse>("/api/system/live", { method: "GET" }),
        apiFetch<HysteriaOverview>("/api/hysteria/stats/overview", { method: "GET" }),
      ]);
      setLive(livePayload);
      setOverview(overviewPayload);
      setLivePoints((current) => pushLivePoint(current, livePayload, overviewPayload));

      if (withHistory) {
        const historyPayload = await apiFetch<{ items: HysteriaHistoryItem[] }>(
          `/api/hysteria/stats/history?limit=${HISTORY_LIMIT}`,
          { method: "GET" },
        );
        setHistory(aggregateTrafficHistory(historyPayload.items || []));
      }
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(false), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const trafficHistory = useMemo(() => {
    if (history.length > 1) {
      return history;
    }
    return livePoints.map((point) => ({
      at: point.at,
      txBytes: point.totalTxBytes,
      rxBytes: point.totalRxBytes,
      onlineCount: point.onlineCount,
    }));
  }, [history, livePoints]);

  const throughputHistory = useMemo(() => livePoints.slice(-48), [livePoints]);
  const packetRateHistory = useMemo(() => livePoints.slice(-48), [livePoints]);
  const latestPoint = livePoints[livePoints.length - 1] || null;
  const serviceItems = live?.services || [];
  const healthyServices = serviceItems.filter((service) => isHealthyStatus(service.status)).length;
  const serverHealthy = live ? healthyServices === serviceItems.length && !live.errors.length : false;
  const statusLabel = serverHealthy ? "Operational" : "Attention";
  const totalThroughput = live ? live.system.network_rx_bps + live.system.network_tx_bps : 0;

  if (loading) {
    return <LoadingState message="Loading server dashboard..." minHeight={420} />;
  }

  if (!live) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">Live server payload is unavailable.</Alert>
        <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load(true)}>
          Retry
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.25}>
      <PageHeader
        title="Server Dashboard"
        subtitle="Runtime telemetry, traffic trends, and operational health"
        actions={
          <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load(true)}>
            Refresh
          </Button>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {live.errors?.length ? <Alert severity="warning">{live.errors.join(" | ")}</Alert> : null}

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <MetricCard
            label="Server Status"
            value={statusLabel}
            caption={serviceItems.length ? `${healthyServices}/${serviceItems.length} services healthy` : "No service data"}
            tone={serverHealthy ? "success" : "warning"}
            trend={serverHealthy ? "flat" : "down"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <MetricCard
            label="Uptime"
            value={formatUptime(live.system.uptime_seconds)}
            caption={`Collected ${formatTimeTick(Date.parse(live.system.collected_at))}`}
            trend="up"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <MetricCard
            label="Current Throughput"
            value={formatRate(totalThroughput)}
            caption={`In ${formatRate(live.system.network_rx_bps)} | Out ${formatRate(live.system.network_tx_bps)}`}
            trend={trendFromSeries(throughputHistory.map((point) => point.rxBps + point.txBps))}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <MetricCard
            label="Active Sessions"
            value={String(overview?.online_count ?? live.hysteria.online_count ?? 0)}
            caption={`Enabled clients ${overview?.enabled_users ?? live.hysteria.enabled_users ?? 0}`}
            tone="secondary"
            trend={trendFromSeries(throughputHistory.map((point) => point.onlineCount))}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <MetricCard
            label="TCP Packets"
            value={(live.system.tcp_packets || 0).toLocaleString()}
            caption={`${(live.system.tcp_packets_per_sec || 0).toFixed(1)} pkt/s`}
            tone="primary"
            trend={trendFromSeries(packetRateHistory.map((point) => point.tcpPps))}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <MetricCard
            label="UDP Packets"
            value={(live.system.udp_packets || 0).toLocaleString()}
            caption={`${(live.system.udp_packets_per_sec || 0).toFixed(1)} pkt/s`}
            tone="secondary"
            trend={trendFromSeries(packetRateHistory.map((point) => point.udpPps))}
          />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <SectionCard
            title="Traffic History"
            subtitle="Inbound and outbound cumulative traffic"
            actions={
              <Chip
                icon={<TimelineRoundedIcon />}
                label={`${trafficHistory.length} points`}
                size="small"
                variant="outlined"
              />
            }
          >
            <LineChart
              height={290}
              grid={{ horizontal: true }}
              xAxis={[
                {
                  data: trafficHistory.map((point) => point.at),
                  scaleType: "time",
                  valueFormatter: (value) => formatTimeTick(value),
                },
              ]}
              yAxis={[{ valueFormatter: (value) => formatBytes(Number(value || 0)) }]}
              series={[
                {
                  data: trafficHistory.map((point) => point.rxBytes),
                  label: "Download",
                  color: theme.palette.success.main,
                  showMark: false,
                  curve: "monotoneX",
                },
                {
                  data: trafficHistory.map((point) => point.txBytes),
                  label: "Upload",
                  color: theme.palette.primary.main,
                  showMark: false,
                  curve: "monotoneX",
                },
              ]}
              margin={{ left: 72, right: 22, top: 24, bottom: 34 }}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 5 }}>
          <SectionCard
            title="Live Throughput"
            subtitle="Recent inbound and outbound bandwidth"
            actions={
              <Chip
                icon={<InsightsRoundedIcon />}
                label={latestPoint ? `${formatRate(latestPoint.rxBps + latestPoint.txBps)}` : "No samples"}
                size="small"
                variant="outlined"
              />
            }
          >
            <LineChart
              height={290}
              grid={{ horizontal: true }}
              xAxis={[
                {
                  data: throughputHistory.map((point) => point.at),
                  scaleType: "time",
                  valueFormatter: (value) => formatTimeTick(value),
                },
              ]}
              yAxis={[{ valueFormatter: (value) => formatRate(Number(value || 0)) }]}
              series={[
                {
                  data: throughputHistory.map((point) => point.rxBps),
                  label: "Inbound",
                  color: theme.palette.success.main,
                  showMark: false,
                  curve: "monotoneX",
                },
                {
                  data: throughputHistory.map((point) => point.txBps),
                  label: "Outbound",
                  color: theme.palette.secondary.main,
                  showMark: false,
                  curve: "monotoneX",
                },
              ]}
              margin={{ left: 74, right: 22, top: 24, bottom: 34 }}
            />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Protocol Load" subtitle="TCP and UDP packet counters">
            <BarChart
              height={250}
              xAxis={[{ scaleType: "band", data: ["TCP", "UDP"] }]}
              yAxis={[{ valueFormatter: (value) => Number(value || 0).toLocaleString() }]}
              series={[
                {
                  label: "Total packets",
                  data: [live.system.tcp_packets || 0, live.system.udp_packets || 0],
                  color: theme.palette.primary.main,
                },
              ]}
              margin={{ left: 74, right: 22, top: 24, bottom: 30 }}
            />
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                variant="outlined"
                label={`TCP ${(live.system.tcp_packets_per_sec || 0).toFixed(1)} pkt/s`}
                color="primary"
              />
              <Chip
                size="small"
                variant="outlined"
                label={`UDP ${(live.system.udp_packets_per_sec || 0).toFixed(1)} pkt/s`}
                color="secondary"
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Source: ${live.system.packets_source || "unknown"}`}
                color={live.system.packets_is_stale ? "warning" : "success"}
              />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Protocol Trends" subtitle="Short-term packet rate dynamics">
            <LineChart
              height={250}
              grid={{ horizontal: true }}
              xAxis={[
                {
                  data: packetRateHistory.map((point) => point.at),
                  scaleType: "time",
                  valueFormatter: (value) => formatTimeTick(value),
                },
              ]}
              yAxis={[{ valueFormatter: (value) => `${Number(value || 0).toFixed(1)} pkt/s` }]}
              series={[
                {
                  data: packetRateHistory.map((point) => point.tcpPps),
                  label: "TCP pkt/s",
                  color: theme.palette.primary.main,
                  showMark: false,
                  curve: "monotoneX",
                },
                {
                  data: packetRateHistory.map((point) => point.udpPps),
                  label: "UDP pkt/s",
                  color: theme.palette.secondary.main,
                  showMark: false,
                  curve: "monotoneX",
                },
              ]}
              margin={{ left: 74, right: 22, top: 24, bottom: 30 }}
            />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Host Health" subtitle="Resource pressure and runtime condition">
            <Stack spacing={1.5}>
              <Stack spacing={0.7}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    CPU Utilization
                  </Typography>
                  <Typography variant="body2">{live.system.cpu_usage_percent.toFixed(1)}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, live.system.cpu_usage_percent))} />
              </Stack>

              <Stack spacing={0.7}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Memory Utilization
                  </Typography>
                  <Typography variant="body2">{live.system.memory_used_percent.toFixed(1)}%</Typography>
                </Stack>
                <LinearProgress
                  color="secondary"
                  variant="determinate"
                  value={Math.max(0, Math.min(100, live.system.memory_used_percent))}
                />
              </Stack>

              <Grid container spacing={1.25}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Memory Used
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {formatBytes(live.system.memory_used_bytes)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Memory Total
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {formatBytes(live.system.memory_total_bytes)}
                  </Typography>
                </Grid>
              </Grid>
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard
            title="Service Health"
            subtitle="Managed service availability and data freshness"
            actions={
              <Chip
                size="small"
                variant="outlined"
                label={`Updated ${formatDateTime(live.collected_at)}`}
                color={live.system.is_stale ? "warning" : "success"}
              />
            }
          >
            <Stack spacing={1.15}>
              {serviceItems.map((service) => (
                <Stack
                  key={service.service_name}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 0.4 }}
                >
                  <Stack spacing={0.2}>
                    <Typography variant="subtitle2">{service.service_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Checked {formatDateTime(service.last_check_at)} ({service.source})
                    </Typography>
                  </Stack>
                  <StatusChip status={service.status} />
                </Stack>
              ))}

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.5 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Hysteria source: ${live.hysteria.source}`}
                  color={live.hysteria.is_stale ? "warning" : "success"}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`System source: ${live.system.source}`}
                  color={live.system.is_stale ? "warning" : "success"}
                />
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
