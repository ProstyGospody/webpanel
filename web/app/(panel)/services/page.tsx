"use client";

import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState, LoadingState } from "@/components/ui/state-message";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { ServiceDetails, ServiceSummary } from "@/types/common";
import { formatDateTime } from "@/utils/format";

type ActionState = { name: string; action: "restart" | "reload" } | null;

function isHealthyService(status: string): boolean {
  const value = (status || "").toLowerCase();
  return value.includes("active") || value.includes("running") || value.includes("enabled");
}

export default function ServicesPage() {
  const [items, setItems] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<ServiceDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionState, setActionState] = useState<ActionState>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await apiFetch<{ items: ServiceSummary[] }>("/api/services", { method: "GET" });
      setItems(payload.items || []);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const healthyCount = useMemo(
    () => items.filter((item) => isHealthyService(item.status || "unknown")).length,
    [items],
  );

  async function openDetails(name: string) {
    setBusy(true);
    try {
      const payload = await apiFetch<ServiceDetails>(`/api/services/${name}?lines=120`, { method: "GET" });
      setDetails(payload);
      setDetailsOpen(true);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load service details");
    } finally {
      setBusy(false);
    }
  }

  async function runAction() {
    if (!actionState) return;
    setBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(
        `/api/services/${actionState.name}/${actionState.action}`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setActionState(null);
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to run action");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2.25}>
      <PageHeader
        title="Services"
        subtitle="Observe managed service states and trigger restart/reload operations"
        actions={
          <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip variant="outlined" label={`Total: ${items.length}`} />
        <Chip variant="outlined" color="success" label={`Healthy: ${healthyCount}`} />
        <Chip variant="outlined" color={healthyCount === items.length ? "success" : "warning"} label={`Needs attention: ${Math.max(0, items.length - healthyCount)}`} />
      </Stack>

      <SectionCard title="Managed Services" subtitle="Direct controls for systemd-managed processes">
        {loading ? (
          <LoadingState message="Loading services..." minHeight={320} />
        ) : items.length === 0 ? (
          <EmptyState title="No services available" description="Service manager did not return any records." />
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
                {items.map((item) => (
                  <TableRow key={item.service_name} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{item.service_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={item.status || "unknown"} />
                    </TableCell>
                    <TableCell>{item.version || "-"}</TableCell>
                    <TableCell>{formatDateTime(item.last_check_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Details and logs">
                          <IconButton size="small" onClick={() => void openDetails(item.service_name)}>
                            <PreviewRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reload service">
                          <IconButton size="small" onClick={() => setActionState({ name: item.service_name, action: "reload" })}>
                            <SyncRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restart service">
                          <IconButton size="small" onClick={() => setActionState({ name: item.service_name, action: "restart" })}>
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
      </SectionCard>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{details?.name || "Service"} details</DialogTitle>
        <DialogContent>
          {details ? (
            <Stack spacing={1.4}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Status:
                </Typography>
                <StatusChip status={details.status_text} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Active: {details.active} / {details.sub_state}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                PID: {details.main_pid || 0} | Checked: {formatDateTime(details.checked_at)}
              </Typography>
              <Typography variant="subtitle2" sx={{ pt: 0.6 }}>
                Recent logs
              </Typography>
              <Paper variant="outlined" sx={{ bgcolor: "background.default", p: 1.4 }}>
                <Typography
                  component="pre"
                  sx={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: "0.78rem",
                    lineHeight: 1.45,
                    maxHeight: 380,
                    overflow: "auto",
                  }}
                >
                  {details.last_logs?.length ? details.last_logs.join("\n") : "No logs available"}
                </Typography>
              </Paper>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(actionState)}
        title="Confirm service action"
        description={`${actionState?.action === "restart" ? "Restart" : "Reload"} ${actionState?.name || "service"} now?`}
        busy={busy}
        confirmText="Confirm"
        confirmColor="primary"
        onClose={() => setActionState(null)}
        onConfirm={() => void runAction()}
      />
    </Stack>
  );
}
