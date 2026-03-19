"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { StatusChip } from "@/components/common/status-chip";
import { APIError, apiFetch } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { HysteriaUser, HysteriaUserPayload } from "@/lib/types";

type FormState = { username: string; password: string; note: string };
const emptyForm: FormState = { username: "", password: "", note: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<HysteriaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [editing, setEditing] = useState<HysteriaUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<HysteriaUser | null>(null);
  const [artifactTarget, setArtifactTarget] = useState<HysteriaUserPayload | null>(null);

  const loadUsers = useCallback(async () => {
    setError("");
    try {
      const payload = await apiFetch<{ items: HysteriaUser[] }>("/api/hysteria/users?limit=500", { method: "GET" });
      setUsers(payload.items || []);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormBusy(true);
    try {
      if (editing) {
        const body: Record<string, string> = { username: form.username, note: form.note };
        if (form.password.trim()) body.password = form.password;
        await apiFetch<HysteriaUserPayload>(`/api/hysteria/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setSnack("Client updated");
      } else {
        await apiFetch<HysteriaUserPayload>("/api/hysteria/users", {
          method: "POST",
          body: JSON.stringify({ username: form.username, password: form.password, note: form.note }),
        });
        setSnack("Client created");
      }
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to save client");
    } finally {
      setFormBusy(false);
    }
  }

  async function setEnabled(user: HysteriaUser, enabled: boolean) {
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${user.id}/${enabled ? "enable" : "disable"}`, { method: "POST", body: JSON.stringify({}) });
      await loadUsers();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to change state");
    }
  }

  async function kick(user: HysteriaUser) {
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${user.id}/kick`, { method: "POST", body: JSON.stringify({}) });
      setSnack("Live session kicked");
      await loadUsers();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to kick session");
    }
  }

  async function revoke() {
    if (!deleteTarget) return;
    setFormBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${deleteTarget.id}/revoke`, { method: "POST", body: JSON.stringify({}) });
      setSnack("Client revoked");
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to revoke client");
    } finally {
      setFormBusy(false);
    }
  }

  async function openArtifacts(user: HysteriaUser) {
    try {
      const payload = await apiFetch<HysteriaUserPayload>(`/api/hysteria/users/${user.id}/artifacts`, { method: "GET" });
      setArtifactTarget(payload);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load artifacts");
    }
  }

  function downloadConfigFile() {
    if (!artifactTarget?.artifacts?.client_config || !artifactTarget?.user.username) return;
    const blob = new Blob([artifactTarget.artifacts.client_config], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${artifactTarget.user.username}-hysteria2.yaml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setSnack("Copied");
    } catch {
      setError("Clipboard write failed");
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Client Management"
        subtitle="Manage Hysteria 2 identities and generated access artifacts."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void loadUsers()}>Reload</Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setFormOpen(true); setEditing(null); setForm(emptyForm); }}>Add Client</Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}><CircularProgress size={28} /><Typography color="text.secondary">Loading clients...</Typography></Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Online</TableCell>
                    <TableCell>Traffic</TableCell>
                    <TableCell>Last Seen</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell><Typography sx={{ fontWeight: 700 }}>{user.username}</Typography><Typography variant="caption" color="text.secondary">{user.note || "No note"}</Typography></TableCell>
                      <TableCell><Stack direction="row" spacing={1} alignItems="center"><Switch size="small" checked={user.enabled} onChange={() => void setEnabled(user, !user.enabled)} /><StatusChip status={user.enabled ? "enabled" : "disabled"} /></Stack></TableCell>
                      <TableCell>{user.online_count}</TableCell>
                      <TableCell>{formatBytes(user.last_tx_bytes + user.last_rx_bytes)}</TableCell>
                      <TableCell>{formatDateTime(user.last_seen_at || user.updated_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Artifacts"><IconButton size="small" onClick={() => void openArtifacts(user)}><KeyRoundedIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(user); setForm({ username: user.username, password: "", note: user.note || "" }); setFormOpen(true); }}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Kick Session"><span><IconButton size="small" disabled={!user.enabled} onClick={() => void kick(user)}><PowerSettingsNewRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="Revoke"><IconButton size="small" color="error" onClick={() => setDeleteTarget(user)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
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

      <Dialog open={formOpen} onClose={() => !formBusy && setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Client" : "Create Client"}</DialogTitle>
        <Box component="form" onSubmit={submitForm}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField label="Username" value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} required fullWidth />
              <TextField label={editing ? "Password (optional)" : "Password"} value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} required={!editing} fullWidth />
              <TextField label="Note" value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} fullWidth multiline minRows={2} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)} disabled={formBusy}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={formBusy}>{formBusy ? "Saving..." : "Save"}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !formBusy && setDeleteTarget(null)}>
        <DialogTitle>Revoke client</DialogTitle>
        <DialogContent><Typography>Revoke <strong>{deleteTarget?.username}</strong> and remove access?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={formBusy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void revoke()} disabled={formBusy}>{formBusy ? "Revoking..." : "Revoke"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(artifactTarget)} onClose={() => setArtifactTarget(null)} fullWidth maxWidth="md">
        <DialogTitle>{artifactTarget?.user.username || "Client"} access artifacts</DialogTitle>
        <DialogContent>
          {artifactTarget?.artifacts ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField label="Primary URI" value={artifactTarget.artifacts.uri} fullWidth InputProps={{ readOnly: true }} />
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(artifactTarget.artifacts.uri)}>Copy</Button>
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField label="hy2:// URI" value={artifactTarget.artifacts.uri_hy2} fullWidth InputProps={{ readOnly: true }} />
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(artifactTarget.artifacts.uri_hy2)}>Copy</Button>
              </Stack>
              <TextField label="Client config" value={artifactTarget.artifacts.client_config} multiline minRows={10} fullWidth InputProps={{ readOnly: true }} />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(artifactTarget.artifacts.client_config)}>Copy Config</Button>
                <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={downloadConfigFile}>Download YAML</Button>
              </Stack>
              <Box component="img" alt="Hysteria QR" src={`/api/hysteria/users/${artifactTarget.user.id}/qr?size=360`} sx={{ width: 220, height: 220, borderRadius: 2, bgcolor: "common.white", p: 1, alignSelf: "center" }} />
            </Stack>
          ) : <Alert severity="warning">No artifacts available.</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setArtifactTarget(null)}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={2600} onClose={() => setSnack("")} message={snack} />
    </Stack>
  );
}
