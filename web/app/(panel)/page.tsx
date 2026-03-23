"use client";

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

import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { ServiceDetails, ServiceSummary, SystemLiveResponse } from "@/types/common";
import { formatBytes, formatDateTime, formatRate, formatUptime } from "@/utils/format";

const LIVE_POLL_MS = 5000;

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

export default function DashboardPage() {
  const [live, setLive] = useState<SystemLiveResponse | null>(null);
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
