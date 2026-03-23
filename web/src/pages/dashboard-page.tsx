import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DataUsageRoundedIcon from "@mui/icons-material/DataUsageRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import RouterRoundedIcon from "@mui/icons-material/RouterRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  Alert,
  Box,
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
import { LineChart } from "@mui/x-charts/LineChart";
import { alpha, useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { ServiceDetails, ServiceSummary, SystemHistoryResponse, SystemLiveResponse } from "@/types/common";
import { formatBytes, formatDateTime, formatRate, formatUptime } from "@/utils/format";

const LIVE_POLL_MS = 5000;
const HISTORY_POLL_MS = 15000;
const HISTORY_WINDOW = "1h";
const HISTORY_STEP_SECONDS = 15;
const HISTORY_LIMIT = 20000;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

type MetricTile = {
  label: string;
  value: string;
  valueSecondary?: string;
  tone: "primary" | "secondary" | "success" | "info" | "warning";
  icon: SvgIconComponent;
};

type ActionState = { name: string; action: "restart" | "reload" } | null;

type TrendMetricKey = "cpu" | "ram" | "download" | "upload";

type HistoryTrendPoint = {
  timestamp: Date;
} & Record<TrendMetricKey, number>;

type TrendChartSeries = {
  label: string;
  color: string;
  dataKey: TrendMetricKey;
};

type TrendChartCardProps = {
  title: string;
  subtitle: string;
  points: HistoryTrendPoint[];
  series: TrendChartSeries[];
  valueFormatter: (value: number) => string;
  minValue?: number;
  maxValue?: number;
};

function formatShortTime(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "--:--";
  }
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TrendChartCard({ title, subtitle, points, series, valueFormatter, minValue, maxValue }: TrendChartCardProps) {
  const normalizedPoints = useMemo(
    () =>
      points
        .filter((point) => point.timestamp instanceof Date && !Number.isNaN(point.timestamp.getTime()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [points],
  );

  const latestPoint = normalizedPoints.length ? normalizedPoints[normalizedPoints.length - 1] : null;

  if (!normalizedPoints.length) {
    return (
      <Card variant="outlined" sx={{ height: "100%" }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Not enough data for chart yet.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              {series.map((line) => (
                <Stack key={line.label} direction="row" spacing={0.6} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: line.color, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {line.label}: {latestPoint ? valueFormatter(latestPoint[line.dataKey]) : "-"}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>

          <LineChart
            dataset={normalizedPoints}
            height={210}
            margin={{ top: 16, right: 20, bottom: 28, left: 64 }}
            grid={{ horizontal: true }}
            xAxis={[
              {
                dataKey: "timestamp",
                scaleType: "time",
                valueFormatter: (value) => formatShortTime(value instanceof Date ? value : new Date(Number(value))),
              },
            ]}
            yAxis={[
              {
                min: minValue,
                max: maxValue,
                valueFormatter: (value) => {
                  const numeric = Number(value);
                  return valueFormatter(Number.isFinite(numeric) ? numeric : 0);
                },
              },
            ]}
            series={series.map((line) => ({
              dataKey: line.dataKey,
              label: line.label,
              color: line.color,
              showMark: false,
            }))}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const theme = useTheme();
  const [live, setLive] = useState<SystemLiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyItems, setHistoryItems] = useState<SystemHistoryResponse["items"]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [serviceItems, setServiceItems] = useState<ServiceSummary[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesBusy, setServicesBusy] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails | null>(null);
  const [serviceDetailsOpen, setServiceDetailsOpen] = useState(false);
  const [serviceActionState, setServiceActionState] = useState<ActionState>(null);
  const loadingRef = useRef(false);
  const historyLoadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setError("");
    try {
      const livePayload = await apiFetch<SystemLiveResponse>("/api/system/live", { method: "GET" });
      setLive(livePayload);
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

  const loadHistory = useCallback(async () => {
    if (historyLoadingRef.current) {
      return;
    }

    historyLoadingRef.current = true;
    setHistoryError("");
    try {
      const payload = await apiFetch<SystemHistoryResponse>(
        `/api/system/history?window=${HISTORY_WINDOW}&step=${HISTORY_STEP_SECONDS}&limit=${HISTORY_LIMIT}`,
        { method: "GET" },
      );
      setHistoryItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setHistoryError(err instanceof APIError ? err.message : "Failed to load history");
    } finally {
      historyLoadingRef.current = false;
      setHistoryLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void loadHistory();
    const timer = setInterval(() => void loadHistory(), HISTORY_POLL_MS);
    return () => clearInterval(timer);
  }, [loadHistory]);

  const warningMessages = useMemo(() => {
    return live?.errors || [];
  }, [live]);

  async function openServiceDetails(name: string) {
    setServicesBusy(true);
    try {
      const payload = await apiFetch<ServiceDetails>(`/api/services/${name}?lines=60`, { method: "GET" });
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

  const showInitialLoading = loading && !live;
  const cpuPercent = clampPercent(live?.system.cpu_usage_percent ?? 0);
  const ramPercent = clampPercent(live?.system.memory_used_percent ?? 0);
  const onlineUsers = Math.max(0, live?.hysteria.online_count ?? 0);
  const networkRx = Math.max(0, live?.system.network_rx_bps ?? 0);
  const networkTx = Math.max(0, live?.system.network_tx_bps ?? 0);
  const uptime = formatUptime(live?.system.uptime_seconds ?? 0);
  const totalTraffic = Math.max(0, (live?.hysteria.total_rx_bytes ?? 0) + (live?.hysteria.total_tx_bytes ?? 0));
  const tcpConnections = Math.max(0, Math.round(live?.system.tcp_sockets ?? 0));
  const udpConnections = Math.max(0, Math.round(live?.system.udp_sockets ?? 0));
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
    {
      label: "PACKETS",
      value: `TCP ${tcpConnections.toLocaleString()}`,
      valueSecondary: `UDP ${udpConnections.toLocaleString()}`,
      tone: "info",
      icon: SettingsEthernetRoundedIcon,
    },
  ];

  const historyPoints = useMemo<HistoryTrendPoint[]>(() => {
    return historyItems
      .map((sample) => {
        const timestamp = new Date(sample.timestamp);
        if (Number.isNaN(timestamp.getTime())) {
          return null;
        }
        return {
          timestamp,
          cpu: clampPercent(sample.cpu_usage_percent),
          ram: clampPercent(sample.memory_used_percent),
          download: Math.max(0, sample.network_rx_bps || 0),
          upload: Math.max(0, sample.network_tx_bps || 0),
        };
      })
      .filter((item): item is HistoryTrendPoint => Boolean(item))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [historyItems]);

  const cpuSeries: TrendChartSeries[] = [
    { label: "CPU", color: theme.palette.primary.main, dataKey: "cpu" },
  ];
  const ramSeries: TrendChartSeries[] = [
    { label: "RAM", color: theme.palette.secondary.main, dataKey: "ram" },
  ];
  const networkSeries: TrendChartSeries[] = [
    { label: "Download", color: theme.palette.info.main, dataKey: "download" },
    { label: "Upload", color: theme.palette.success.main, dataKey: "upload" },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader title="Overview" />

      {showInitialLoading ? <Alert severity="info">Loading latest dashboard metrics...</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {warningMessages.length ? <Alert severity="warning">{warningMessages.join(" | ")}</Alert> : null}

      <Grid container spacing={1.5} columns={{ xs: 12, sm: 12, md: 12, lg: 14, xl: 14 }}>
        {metricTiles.map((tile) => {
          const hasSecondary = Boolean(tile.valueSecondary);
          const Icon = tile.icon;
          return (
            <Grid key={tile.label} size={{ xs: 12, sm: 6, md: 4, lg: 2, xl: 2 }}>
              <Card
                variant="outlined"
                sx={(theme) => ({
                  height: { xs: "100%", sm: 82 },
                  borderColor: alpha(theme.palette[tile.tone].main, 0.32),
                  backgroundColor: alpha(theme.palette.background.paper, 0.9),
                })}
              >
                <CardContent
                  sx={{
                    pt: 0.4,
                    pb: 0.55,
                    px: 1.15,
                    position: "relative",
                    height: "100%",
                    minHeight: { xs: 76, sm: 82 },
                  }}
                >
                  <Stack spacing={0} sx={{ pr: { xs: 5.6, sm: 6 }, alignItems: "flex-start" }}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                        fontWeight: 800,
                        fontSize: { xs: "0.72rem", sm: "0.78rem", md: "0.82rem" },
                      }}
                    >
                      {tile.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 900,
                        lineHeight: 1.03,
                        fontSize: hasSecondary
                          ? { xs: "1.02rem", sm: "1.12rem", md: "1.22rem" }
                          : { xs: "1.54rem", sm: "1.66rem", md: "1.8rem" },
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {tile.value}
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 900,
                        lineHeight: 1.03,
                        fontSize: { xs: "0.9rem", sm: "0.98rem", md: "1.06rem" },
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                        visibility: hasSecondary ? "visible" : "hidden",
                      }}
                    >
                      {tile.valueSecondary || "\u00A0"}
                    </Typography>
                  </Stack>
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: { xs: 5, sm: 5 },
                      width: { xs: 22, sm: 24, md: 26 },
                      height: { xs: 22, sm: 24, md: 26 },
                    }}
                  >
                    <Icon
                      color={tile.tone}
                      sx={{
                        display: "block",
                        fontSize: hasSecondary
                          ? { xs: "1.28rem", sm: "1.36rem", md: "1.44rem" }
                          : { xs: "1.34rem", sm: "1.42rem", md: "1.5rem" },
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Stack spacing={1.5}>
        {historyLoading && !historyPoints.length ? <Alert severity="info">Loading system history...</Alert> : null}
        {historyError ? <Alert severity="warning">{historyError}</Alert> : null}
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <TrendChartCard
              title="CPU"
              subtitle="Server usage for the last hour"
              points={historyPoints}
              series={cpuSeries}
              minValue={0}
              maxValue={100}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <TrendChartCard
              title="RAM"
              subtitle="Memory usage for the last hour"
              points={historyPoints}
              series={ramSeries}
              minValue={0}
              maxValue={100}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 12, lg: 4 }}>
            <TrendChartCard
              title="Upload / Download"
              subtitle="Network speed for the last hour"
              points={historyPoints}
              series={networkSeries}
              valueFormatter={(value) => formatRate(value)}
            />
          </Grid>
        </Grid>
      </Stack>

      <Stack spacing={1.5}>
        {servicesError ? <Alert severity="error">{servicesError}</Alert> : null}
        {servicesLoading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading services...</Typography>
          </Stack>
        ) : (
          <TableContainer>
            <Table>
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
                {serviceItems.length ? (
                  serviceItems.map((item) => (
                    <TableRow key={item.service_name} hover>
                      <TableCell>{item.service_name}</TableCell>
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        Service activity is not available yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
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
