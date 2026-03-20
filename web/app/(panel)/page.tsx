"use client";

import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DataUsageRoundedIcon from "@mui/icons-material/DataUsageRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import RouterRoundedIcon from "@mui/icons-material/RouterRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import { Alert, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardChartRange, OverviewCharts, SystemTrendSample } from "@/components/charts/overview-charts";
import { PageHeader } from "@/components/ui/page-header";
import { APIError, apiFetch } from "@/services/api";
import { SystemHistoryResponse, SystemLiveResponse } from "@/types/common";
import { formatBytes, formatRate, formatUptime } from "@/utils/format";

const LIVE_POLL_MS = 6000;
const TREND_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_TREND_SAMPLES = 16000;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function toTrendSample(live: SystemLiveResponse): SystemTrendSample {
  const sourceTimestamp = live.system.collected_at || live.collected_at;
  const timestampMs = Date.parse(sourceTimestamp || "");
  const timestamp = Number.isNaN(timestampMs) ? new Date().toISOString() : new Date(timestampMs).toISOString();

  return {
    timestamp,
    cpu_usage_percent: clampPercent(live.system.cpu_usage_percent),
    memory_used_percent: clampPercent(live.system.memory_used_percent),
    network_rx_bps: Math.max(0, live.system.network_rx_bps || 0),
    network_tx_bps: Math.max(0, live.system.network_tx_bps || 0),
  };
}

function normalizeTrendSample(sample: {
  timestamp: string;
  cpu_usage_percent: number;
  memory_used_percent: number;
  network_rx_bps: number;
  network_tx_bps: number;
}): SystemTrendSample | null {
  const timestampMs = Date.parse(sample.timestamp || "");
  if (Number.isNaN(timestampMs)) {
    return null;
  }

  const cpu = Number(sample.cpu_usage_percent);
  const ram = Number(sample.memory_used_percent);
  const rx = Number(sample.network_rx_bps);
  const tx = Number(sample.network_tx_bps);

  if (!Number.isFinite(cpu) || !Number.isFinite(ram) || !Number.isFinite(rx) || !Number.isFinite(tx)) {
    return null;
  }

  return {
    timestamp: new Date(timestampMs).toISOString(),
    cpu_usage_percent: clampPercent(cpu),
    memory_used_percent: clampPercent(ram),
    network_rx_bps: Math.max(0, rx),
    network_tx_bps: Math.max(0, tx),
  };
}

function appendTrendSample(current: SystemTrendSample[], sample: SystemTrendSample): SystemTrendSample[] {
  const cutoff = Date.now() - TREND_RETENTION_MS;
  const retained = current.filter((point) => {
    const timestampMs = Date.parse(point.timestamp);
    return !Number.isNaN(timestampMs) && timestampMs >= cutoff;
  });

  const last = retained.length ? retained[retained.length - 1] : null;
  if (last && last.timestamp === sample.timestamp) {
    retained[retained.length - 1] = sample;
  } else {
    retained.push(sample);
  }

  if (retained.length > MAX_TREND_SAMPLES) {
    return retained.slice(retained.length - MAX_TREND_SAMPLES);
  }
  return retained;
}

function mergeTrendSamples(current: SystemTrendSample[], incoming: SystemTrendSample[]): SystemTrendSample[] {
  const sorted = [...incoming].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  let merged = current;
  for (const item of sorted) {
    merged = appendTrendSample(merged, item);
  }
  return merged;
}

export default function DashboardPage() {
  const [live, setLive] = useState<SystemLiveResponse | null>(null);
  const [trendSamples, setTrendSamples] = useState<SystemTrendSample[]>([]);
  const [chartRange, setChartRange] = useState<DashboardChartRange>("1h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const historyLoadedRef = useRef(false);
  const loadingRef = useRef(false);

  const loadHistory = useCallback(async (force?: boolean) => {
    if (historyLoadedRef.current && !force) {
      return;
    }

    try {
      const payload = await apiFetch<SystemHistoryResponse>("/api/system/history?limit=20000", { method: "GET" });
      const items = (payload.items || [])
        .map((item) => normalizeTrendSample(item))
        .filter((item): item is SystemTrendSample => item !== null);
      setTrendSamples((current) => mergeTrendSamples(current, items));
      historyLoadedRef.current = true;
    } catch {
      // Keep dashboard functional even if history endpoint is temporarily unavailable.
      historyLoadedRef.current = false;
    }
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setError("");
    try {
      const livePayload = await apiFetch<SystemLiveResponse>("/api/system/live", { method: "GET" });
      setLive(livePayload);
      setTrendSamples((current) => appendTrendSample(current, toTrendSample(livePayload)));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load dashboard data");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    const retryTimer = setInterval(() => {
      if (!historyLoadedRef.current) {
        void loadHistory(true);
      }
    }, 20000);
    return () => clearInterval(retryTimer);
  }, [loadHistory]);

  useEffect(() => {
    if (chartRange === "24h" && !historyLoadedRef.current) {
      void loadHistory(true);
    }
  }, [chartRange, loadHistory]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const warningMessages = useMemo(() => {
    return (live?.errors || []).filter((item) => !/tcp|udp|packet/i.test(item));
  }, [live]);

  if (loading && !live) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} spacing={2}>
        <CircularProgress />
        <Typography color="text.secondary">Loading dashboard...</Typography>
      </Stack>
    );
  }

  const cpuPercent = clampPercent(live?.system.cpu_usage_percent ?? 0);
  const ramPercent = clampPercent(live?.system.memory_used_percent ?? 0);
  const onlineUsers = Math.max(0, live?.hysteria.online_count ?? 0);
  const networkRx = Math.max(0, live?.system.network_rx_bps ?? 0);
  const networkTx = Math.max(0, live?.system.network_tx_bps ?? 0);
  const uptime = formatUptime(live?.system.uptime_seconds ?? 0);
  const totalTraffic = Math.max(0, (live?.hysteria.total_rx_bytes ?? 0) + (live?.hysteria.total_tx_bytes ?? 0));

  return (
    <Stack spacing={3}>
      <PageHeader title="Overview" />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {warningMessages.length ? <Alert severity="warning">{warningMessages.join(" | ")}</Alert> : null}

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip
          color="primary"
          variant="outlined"
          icon={<MemoryRoundedIcon />}
          label={`CPU ${cpuPercent.toFixed(1)}%`}
          sx={{ "& .MuiChip-label": { fontWeight: 600 } }}
        />
        <Chip
          color="secondary"
          variant="outlined"
          icon={<StorageRoundedIcon />}
          label={`RAM ${ramPercent.toFixed(1)}%`}
          sx={{ "& .MuiChip-label": { fontWeight: 600 } }}
        />
        <Chip
          color="success"
          variant="outlined"
          icon={<PeopleAltRoundedIcon />}
          label={`Online ${onlineUsers}`}
          sx={{ "& .MuiChip-label": { fontWeight: 600 } }}
        />
        <Chip
          color="info"
          variant="outlined"
          icon={<RouterRoundedIcon />}
          label={`Network in ${formatRate(networkRx)} | out ${formatRate(networkTx)}`}
          sx={{ "& .MuiChip-label": { fontWeight: 600 } }}
        />
        <Chip
          color="warning"
          variant="outlined"
          icon={<AccessTimeRoundedIcon />}
          label={`Uptime ${uptime}`}
          sx={{ "& .MuiChip-label": { fontWeight: 600 } }}
        />
        <Chip
          color="primary"
          variant="outlined"
          icon={<DataUsageRoundedIcon />}
          label={`Total Traffic ${formatBytes(totalTraffic)}`}
          sx={{ "& .MuiChip-label": { fontWeight: 600 } }}
        />
      </Stack>

      <OverviewCharts
        loading={loading && trendSamples.length <= 1}
        samples={trendSamples}
        range={chartRange}
        onRangeChange={setChartRange}
      />
    </Stack>
  );
}
