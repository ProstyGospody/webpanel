"use client";

import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { formatBytes, formatDateTime, formatRate, formatUptime } from "@/utils/format";
import { HysteriaOverview, SystemLiveResponse } from "@/types/common";

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{hint}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [live, setLive] = useState<SystemLiveResponse | null>(null);
  const [overview, setOverview] = useState<HysteriaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [livePayload, overviewPayload] = await Promise.all([
        apiFetch<SystemLiveResponse>("/api/system/live", { method: "GET" }),
        apiFetch<HysteriaOverview>("/api/hysteria/stats/overview", { method: "GET" }),
      ]);
      setLive(livePayload);
      setOverview(overviewPayload);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} spacing={2}>
        <CircularProgress />
        <Typography color="text.secondary">Loading operational overview...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Overview"
        subtitle="System and Hysteria status"
        actions={<Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>Refresh</Button>}
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {live?.errors?.length ? <Alert severity="warning">{live.errors.join(" | ")}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Enabled Clients" value={String(overview?.enabled_users ?? live?.hysteria.enabled_users ?? 0)} hint="Enabled" />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Online Sessions" value={String(overview?.online_count ?? live?.hysteria.online_count ?? 0)} hint="Online" />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Total Upload" value={formatBytes(overview?.total_tx_bytes ?? live?.hysteria.total_tx_bytes ?? 0)} hint="Upload" />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Total Download" value={formatBytes(overview?.total_rx_bytes ?? live?.hysteria.total_rx_bytes ?? 0)} hint="Download" />
        </Grid>
      </Grid>

      {live ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card>
              <CardContent>
                <Stack spacing={2.25}>
                  <Typography variant="h5">Host Runtime</Typography>

                  <Stack spacing={0.8}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">CPU utilization</Typography>
                      <Typography variant="body2">{live.system.cpu_usage_percent.toFixed(1)}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, live.system.cpu_usage_percent))} />
                  </Stack>

                  <Stack spacing={0.8}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Memory utilization</Typography>
                      <Typography variant="body2">{live.system.memory_used_percent.toFixed(1)}%</Typography>
                    </Stack>
                    <LinearProgress color="secondary" variant="determinate" value={Math.max(0, Math.min(100, live.system.memory_used_percent))} />
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">Memory Used</Typography>
                      <Typography variant="h6">{formatBytes(live.system.memory_used_bytes)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">Uptime</Typography>
                      <Typography variant="h6">{formatUptime(live.system.uptime_seconds)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">Network In</Typography>
                      <Typography variant="h6">{formatRate(live.system.network_rx_bps)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">Network Out</Typography>
                      <Typography variant="h6">{formatRate(live.system.network_tx_bps)}</Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="caption" color="text.secondary">Collected {formatDateTime(live.system.collected_at)} via {live.system.source}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Managed Services</Typography>
                  {live.services.map((service) => (
                    <Stack key={service.service_name} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack>
                        <Typography sx={{ fontWeight: 600 }}>{service.service_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDateTime(service.last_check_at)}</Typography>
                      </Stack>
                      <StatusChip status={service.status} />
                    </Stack>
                  ))}
                  <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                    <Chip label={`Source: ${live.hysteria.source}`} size="small" variant="outlined" />
                    <Chip label={live.hysteria.is_stale ? "Snapshot" : "Live"} size="small" color={live.hysteria.is_stale ? "warning" : "success"} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}
    </Stack>
  );
}


