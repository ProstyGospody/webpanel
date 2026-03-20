"use client";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { APIError, apiFetch } from "@/services/api";
import { formatDateTime } from "@/utils/format";
import { ServiceDetails, ServiceSummary } from "@/types/common";

type ActionState = { name: string; action: "restart" | "reload" } | null;

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

  useEffect(() => { void load(); }, [load]);

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
      await apiFetch<{ ok: boolean }>(`/api/services/${actionState.name}/${actionState.action}`, { method: "POST", body: JSON.stringify({}) });
      setActionState(null);
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to run action");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader title="Services" actions={<Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>Refresh</Button>} />
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}><CircularProgress size={28} /><Typography color="text.secondary">Loading services...</Typography></Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Service</TableCell><TableCell>Status</TableCell><TableCell>Version</TableCell><TableCell>Last Check</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.service_name} hover>
                      <TableCell><Typography sx={{ fontWeight: 700 }}>{item.service_name}</Typography></TableCell>
                      <TableCell><StatusChip status={item.status || "unknown"} /></TableCell>
                      <TableCell>{item.version || "-"}</TableCell>
                      <TableCell>{formatDateTime(item.last_check_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Details & Logs"><IconButton size="small" onClick={() => void openDetails(item.service_name)}><PreviewRoundedIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Reload"><IconButton size="small" onClick={() => setActionState({ name: item.service_name, action: "reload" })}><SyncRoundedIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Restart"><IconButton size="small" onClick={() => setActionState({ name: item.service_name, action: "restart" })}><RestartAltRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{details?.name || "Service"} details</DialogTitle>
        <DialogContent>
          {details ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" color="text.secondary">Status:</Typography><StatusChip status={details.status_text} /></Stack>
              <Typography variant="body2" color="text.secondary">Active: {details.active} / {details.sub_state}</Typography>
              <Typography variant="body2" color="text.secondary">PID: {details.main_pid || 0} | Checked: {formatDateTime(details.checked_at)}</Typography>
              <Typography variant="subtitle2" sx={{ pt: 1 }}>Recent logs</Typography>
              <Card variant="outlined" sx={{ bgcolor: (theme) => theme.palette.background.default }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography component="pre" variant="code" sx={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {details.last_logs?.length ? details.last_logs.join("\n") : "No logs available"}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailsOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(actionState)} onClose={() => !busy && setActionState(null)}>
        <DialogTitle>Confirm service action</DialogTitle>
        <DialogContent><Typography>{actionState?.action === "restart" ? "Restart" : "Reload"} <strong>{actionState?.name}</strong> now?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setActionState(null)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => void runAction()} disabled={busy}>{busy ? "Processing..." : "Confirm"}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
