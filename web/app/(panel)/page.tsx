"use client";

import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DataUsageRoundedIcon from "@mui/icons-material/DataUsageRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import RouterRoundedIcon from "@mui/icons-material/RouterRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardChartRange, OverviewCharts, SystemTrendSample } from "@/components/charts/overview-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { ServiceDetails, ServiceSummary, SystemHistoryResponse, SystemLiveResponse } from "@/types/common";
import { formatBytes, formatDateTime, formatRate, formatUptime } from "@/utils/format";

const LIVE_POLL_MS = 3000;
const TREND_RETENTION_MS = 24 * 60 * 60 * 1000;
const TREND_HIGH_RES_WINDOW_MS = 2 * 60 * 60 * 1000;
const TREND_COARSE_BUCKET_MS = 30 * 1000;
const MAX_TREND_SAMPLES = 16000;
const RANGE_WINDOW = {
  "1h": "1h",
  "24h": "24h",
} as const;
const RANGE_STEP = {
  "1h": 3,
  "24h": 30,
} as const;
const RANGE_LIMIT = {
  "1h": 2200,
  "24h": 20000,
} as const;

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

  const compacted = compactTrendSamples(retained);
  if (compacted.length > MAX_TREND_SAMPLES) {
    return compacted.slice(compacted.length - MAX_TREND_SAMPLES);
  }
  return compacted;
}

function compactTrendSamples(samples: SystemTrendSample[]): SystemTrendSample[] {
  if (samples.length <= 1) {
    return samples;
  }

  const highResCutoff = Date.now() - TREND_HIGH_RES_WINDOW_MS;
  const coarseBuckets = new Map<number, SystemTrendSample>();
  const recent: SystemTrendSample[] = [];

  for (const item of samples) {
    const timestampMs = Date.parse(item.timestamp);
    if (Number.isNaN(timestampMs)) {
      continue;
    }
    if (timestampMs >= highResCutoff) {
      recent.push(item);
      continue;
    }
    const bucket = Math.floor(timestampMs / TREND_COARSE_BUCKET_MS);
    coarseBuckets.set(bucket, item);
  }

  return [...coarseBuckets.values(), ...recent];
}

function normalizeHistorySamples(items: SystemHistoryResponse["items"]): SystemTrendSample[] {
  return (items || [])
    .map((item) => normalizeTrendSample(item))
    .filter((item): item is SystemTrendSample => item !== null)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

type MetricTile = {
  label: string;
  value: string;
  valueSecondary?: string;
  tone: "primary" | "secondary" | "success" | "info" | "warning";
  icon: SvgIconComponent;
};

type ActionState = { name: string; action: "restart" | "reload" } | null;

export default function DashboardPage() {
  const [live, setLive] = useState<SystemLiveResponse | null>(null);
  const [trendSamples, setTrendSamples] = useState<SystemTrendSample[]>([]);
  const [chartRange, setChartRange] = useState<DashboardChartRange>("1h");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serviceItems, setServiceItems] = useState<ServiceSummary[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesBusy, setServicesBusy] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails | null>(null);
  const [serviceDetailsOpen, setServiceDetailsOpen] = useState(false);
  const [serviceActionState, setServiceActionState] = useState<ActionState>(null);
  const loadingRef = useRef(false);
  const historyRequestRef = useRef(0);

  const loadHistory = useCallback(async (range: DashboardChartRange) => {
    const requestID = historyRequestRef.current + 1;
    historyRequestRef.current = requestID;
    setHistoryLoading(true);
    try {
      const windowValue = RANGE_WINDOW[range];
      const stepValue = RANGE_STEP[range];
      const limitValue = RANGE_LIMIT[range];
      const payload = await apiFetch<SystemHistoryResponse>(
        `/api/system/history?limit=${limitValue}&window=${windowValue}&step=${stepValue}`,
        { method: "GET" },
      );
      if (historyRequestRef.current !== requestID) {
        return;
      }
      setTrendSamples(normalizeHistorySamples(payload.items));
    } catch {
      // Keep live dashboard functional even if history endpoint is temporarily unavailable.
    } finally {
      if (historyRequestRef.current === requestID) {
        setHistoryLoading(false);
      }
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

  const loadServices = useCallback(async () => {
    setServicesError("");
    try {
      const payload = await apiFetch<{ items: ServiceSummary[] }>("/api/services", { method: "GET" });
      setServiceItems(payload.items || []);
    } catch (err) {
      setServicesError(err instanceof APIError ? err.message : "Failed to load services");
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory(chartRange);
  }, [chartRange, loadHistory]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    void loadServices();
    const timer = setInterval(() => void loadServices(), 15000);
    return () => clearInterval(timer);
  }, [loadServices]);

  const warningMessages = useMemo(() => {
    return (live?.errors || []).filter((item) => !/tcp|udp|packet/i.test(item));
  }, [live]);

  async function openServiceDetails(name: string) {
    setServicesBusy(true);
    try {
      const payload = await apiFetch<ServiceDetails>(`/api/services/${name}?lines=120`, { method: "GET" });
      setServiceDetails(payload);
      setServiceDetailsOpen(true);
    } catch (err) {
      setServicesError(err instanceof APIError ? err.message : "Failed to load service details");
    } finally {
      setServicesBusy(false);
    }
  }

  async function runServiceAction() {
    if (!serviceActionState) return;
    setServicesBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/services/${serviceActionState.name}/${serviceActionState.action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setServiceActionState(null);
      await loadServices();
    } catch (err) {
      setServicesError(err instanceof APIError ? err.message : "Failed to run action");
    } finally {
      setServicesBusy(false);
    }
  }

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
  const metricTiles: MetricTile[] = [
    {
      label: "CPU",
      value: `${cpuPercent.toFixed(1)}%`,
      tone: "primary",
      icon: MemoryRoundedIcon,
    },
    {
      label: "RAM",
      value: `${ramPercent.toFixed(1)}%`,
      tone: "secondary",
      icon: StorageRoundedIcon,
    },
    {
      label: "ONLINE",
      value: `${onlineUsers}`,
      tone: "success",
      icon: PeopleAltRoundedIcon,
    },
    {
      label: "NETWORK",
      value: `↓ ${formatRate(networkRx)}`,
      valueSecondary: `↑ ${formatRate(networkTx)}`,
      tone: "info",
      icon: RouterRoundedIcon,
    },
    {
      label: "UPTIME",
      value: uptime,
      tone: "warning",
      icon: AccessTimeRoundedIcon,
    },
    {
      label: "TRAFFIC",
      value: formatBytes(totalTraffic),
      tone: "primary",
      icon: DataUsageRoundedIcon,
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader title="Overview" />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {warningMessages.length ? <Alert severity="warning">{warningMessages.join(" | ")}</Alert> : null}

      <Grid container spacing={1.5}>
        {metricTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Grid key={tile.label} size={{ xs: 12, sm: 6, md: 4, xl: 2 }}>
              <Card
                variant="outlined"
                sx={(theme) => ({
                  height: { xs: "100%", sm: 122 },
                  borderColor: alpha(theme.palette[tile.tone].main, 0.32),
                  backgroundColor: alpha(theme.palette.background.paper, 0.9),
                })}
              >
                <CardContent
                  sx={{
                    pt: 1.05,
                    pb: 1.6,
                    px: 2,
                    position: "relative",
                    height: "100%",
                    minHeight: { xs: 106, sm: 122 },
                  }}
                >
                  <Stack spacing={0.2} sx={{ pr: { xs: 7, sm: 8 }, alignItems: "flex-start" }}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                        fontWeight: 800,
                        fontSize: { xs: "0.82rem", sm: "0.9rem" },
                      }}
                    >
                      {tile.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 900,
                        lineHeight: 1.1,
                        fontSize: { xs: "1.55rem", sm: "1.72rem", md: "1.88rem" },
                      }}
                    >
                      {tile.value}
                    </Typography>
                    {tile.valueSecondary ? (
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 900,
                          lineHeight: 1.1,
                          fontSize: { xs: "1.45rem", sm: "1.62rem", md: "1.76rem" },
                        }}
                      >
                        {tile.valueSecondary}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                      position: "absolute",
                      right: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: { xs: 42, sm: 48, md: 54 },
                      height: { xs: 42, sm: 48, md: 54 },
                    }}
                  >
                    <Icon
                      color={tile.tone}
                      sx={{
                        display: "block",
                        fontSize: { xs: "2rem", sm: "2.35rem", md: "2.6rem" },
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <OverviewCharts
        loading={(loading && trendSamples.length <= 1) || historyLoading}
        samples={trendSamples}
        range={chartRange}
        onRangeChange={setChartRange}
      />

      <Stack spacing={1.5}>
        {servicesError ? <Alert severity="error">{servicesError}</Alert> : null}
        {servicesLoading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading services...</Typography>
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Last Check</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {serviceItems.map((item) => (
                  <TableRow key={item.service_name} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{item.service_name}</Typography>
                    </TableCell>
                    <TableCell><StatusChip status={item.status || "unknown"} /></TableCell>
                    <TableCell>{item.version || "-"}</TableCell>
                    <TableCell>{formatDateTime(item.last_check_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Details & Logs">
                          <IconButton size="small" onClick={() => void openServiceDetails(item.service_name)} disabled={servicesBusy}>
                            <PreviewRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reload">
                          <IconButton size="small" onClick={() => setServiceActionState({ name: item.service_name, action: "reload" })} disabled={servicesBusy}>
                            <SyncRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restart">
                          <IconButton size="small" onClick={() => setServiceActionState({ name: item.service_name, action: "restart" })} disabled={servicesBusy}>
                            <RestartAltRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      <Dialog open={serviceDetailsOpen} onClose={() => setServiceDetailsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{serviceDetails?.name || "Service"} details</DialogTitle>
        <DialogContent>
          {serviceDetails ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Status:</Typography>
                <StatusChip status={serviceDetails.status_text} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Active: {serviceDetails.active} / {serviceDetails.sub_state}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                PID: {serviceDetails.main_pid || 0} | Checked: {formatDateTime(serviceDetails.checked_at)}
              </Typography>
              <Typography variant="subtitle2" sx={{ pt: 1 }}>Recent logs</Typography>
              <Card variant="outlined" sx={{ bgcolor: (theme) => theme.palette.background.default }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography component="pre" variant="code" sx={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {serviceDetails.last_logs?.length ? serviceDetails.last_logs.join("\n") : "No logs available"}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setServiceDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(serviceActionState)} onClose={() => !servicesBusy && setServiceActionState(null)}>
        <DialogTitle>Confirm service action</DialogTitle>
        <DialogContent>
          <Typography>
            {serviceActionState?.action === "restart" ? "Restart" : "Reload"} <strong>{serviceActionState?.name}</strong> now?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setServiceActionState(null)} disabled={servicesBusy}>Cancel</Button>
          <Button variant="contained" onClick={() => void runServiceAction()} disabled={servicesBusy}>
            {servicesBusy ? "Processing..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
