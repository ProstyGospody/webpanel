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
import DoNotDisturbOnRoundedIcon from "@mui/icons-material/DoNotDisturbOnRounded";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { StatusChip } from "@/components/common/status-chip";
import { APIError, apiFetch } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { HysteriaUser, HysteriaUserPayload } from "@/lib/types";

type FormState = {
  username: string;
  password: string;
  note: string;
};

const emptyForm: FormState = {
  username: "",
  password: "",
  note: "",
};

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
  const [artifactBusy, setArtifactBusy] = useState(false);

  const onlineCount = useMemo(() => users.reduce((acc, item) => acc + item.online_count, 0), [users]);

  const loadUsers = useCallback(async () => {
    setError("");
    try {
      const payload = await apiFetch<{ items: HysteriaUser[] }>("/api/hysteria/users?limit=500", { method: "GET" });
      setUsers(payload.items || []);
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to load clients";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(user: HysteriaUser) {
    setEditing(user);
    setForm({
      username: user.username,
      password: "",
      note: user.note || "",
    });
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormBusy(true);
    try {
      if (editing) {
        const body: Record<string, string> = {
          username: form.username,
          note: form.note,
        };
        if (form.password.trim()) {
          body.password = form.password;
        }
        await apiFetch<HysteriaUserPayload>(`/api/hysteria/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setSnack("Client updated");
      } else {
        await apiFetch<HysteriaUserPayload>("/api/hysteria/users", {
          method: "POST",
          body: JSON.stringify({ username: form.username, password: form.password, note: form.note }),
        });
        setSnack("Client created");
      }
      setFormOpen(false);
      setForm(emptyForm);
      setEditing(null);
      await loadUsers();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to save client";
      setError(message);
    } finally {
      setFormBusy(false);
    }
  }

  async function setEnabled(user: HysteriaUser, enabled: boolean) {
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${user.id}/${enabled ? "enable" : "disable"}`, { method: "POST" });
      setSnack(enabled ? "Client enabled" : "Client disabled");
      await loadUsers();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to change state";
      setError(message);
    }
  }

  async function kick(user: HysteriaUser) {
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${user.id}/kick`, { method: "POST" });
      setSnack("Live session kicked");
      await loadUsers();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to kick session";
      setError(message);
    }
  }

  async function revoke() {
    if (!deleteTarget) {
      return;
    }
    setFormBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${deleteTarget.id}/revoke`, { method: "POST" });
      setSnack("Client revoked");
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to revoke client";
      setError(message);
    } finally {
      setFormBusy(false);
    }
  }

  async function openArtifacts(user: HysteriaUser) {
    setArtifactBusy(true);
    try {
      const payload = await apiFetch<HysteriaUserPayload>(`/api/hysteria/users/${user.id}/artifacts`, { method: "GET" });
      setArtifactTarget(payload);
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to load access artifacts";
      setError(message);
    } finally {
      setArtifactBusy(false);
    }
  }

  function downloadConfigFile() {
    if (!artifactTarget?.artifacts?.client_config || !artifactTarget?.user.username) {
      return;
    }
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
      setSnack("Copied to clipboard");
    } catch {
      setError("Clipboard write failed");
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Client Management"
        subtitle="Create and maintain Hysteria 2 credentials. Access artifacts are generated from the same managed server config used at runtime."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void loadUsers()}>
              Reload
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Add Client
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h5">Active identities</Typography>
            <Stack direction="row" spacing={1}>
              <StatusChip status={`${users.filter((item) => item.enabled).length} enabled`} />
              <StatusChip status={`${onlineCount} online`} />
            </Stack>
          </Stack>

          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">Loading clients...</Typography>
            </Stack>
          ) : users.length === 0 ? (
            <Alert severity="info">No clients yet. Create the first identity to issue connection artifacts.</Alert>
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
                      <TableCell>
                        <Stack>
                          <Typography sx={{ fontWeight: 700 }}>{user.username}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.note || "No note"}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch size="small" checked={user.enabled} onChange={() => void setEnabled(user, !user.enabled)} />
                          <StatusChip status={user.enabled ? "enabled" : "disabled"} />
                        </Stack>
                      </TableCell>
                      <TableCell>{user.online_count}</TableCell>
                      <TableCell>{formatBytes(user.last_tx_bytes + user.last_rx_bytes)}</TableCell>
                      <TableCell>{formatDateTime(user.last_seen_at || user.updated_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Artifacts">
                            <IconButton size="small" onClick={() => void openArtifacts(user)}>
                              <KeyRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(user)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Kick Session">
                            <span>
                              <IconButton size="small" disabled={!user.enabled} onClick={() => void kick(user)}>
                                <PowerSettingsNewRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Revoke">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(user)}>
                              <DeleteOutlineRoundedIcon fontSize="small" />
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
        </CardContent>
      </Card>

      <Dialog open={formOpen} onClose={() => !formBusy && setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Client" : "Create Client"}</DialogTitle>
        <Box component="form" onSubmit={submitForm}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Username"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                required
                fullWidth
                helperText="3-64 chars, lowercase letters, numbers, dot, dash, underscore"
              />
              <TextField
                label={editing ? "Password (leave blank to keep current)" : "Password"}
                type="text"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required={!editing}
                fullWidth
              />
              <TextField
                label="Note"
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)} disabled={formBusy}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={formBusy}>
              {formBusy ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !formBusy && setDeleteTarget(null)}>
        <DialogTitle>Revoke client</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ py: 1 }}>
            <DoNotDisturbOnRoundedIcon color="warning" />
            <Typography>
              Revoke <strong>{deleteTarget?.username}</strong>? This removes runtime access and deletes the identity.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={formBusy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void revoke()} disabled={formBusy}>
            {formBusy ? "Revoking..." : "Revoke"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(artifactTarget)} onClose={() => setArtifactTarget(null)} fullWidth maxWidth="md">
        <DialogTitle>{artifactTarget?.user.username || "Client"} access artifacts</DialogTitle>
        <DialogContent>
          {artifactBusy ? (
            <Stack alignItems="center" sx={{ py: 8 }}>
              <CircularProgress />
            </Stack>
          ) : artifactTarget?.artifacts ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField label="Primary URI" value={artifactTarget.artifacts.uri} fullWidth InputProps={{ readOnly: true }} />
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(artifactTarget.artifacts.uri)}>
                  Copy
                </Button>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField label="hy2:// URI" value={artifactTarget.artifacts.uri_hy2} fullWidth InputProps={{ readOnly: true }} />
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(artifactTarget.artifacts.uri_hy2)}>
                  Copy
                </Button>
              </Stack>

              <TextField label="Client config" value={artifactTarget.artifacts.client_config} multiline minRows={10} fullWidth InputProps={{ readOnly: true }} />

              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(artifactTarget.artifacts.client_config)}>
                  Copy Config
                </Button>
                <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={downloadConfigFile}>
                  Download YAML
                </Button>
              </Stack>

              <Box
                component="img"
                alt="Hysteria QR"
                src={`/api/hysteria/users/${artifactTarget.user.id}/qr?size=360`}
                sx={{ width: 220, height: 220, borderRadius: 2, bgcolor: "common.white", p: 1, alignSelf: "center" }}
              />
            </Stack>
          ) : (
            <Alert severity="warning">No access artifacts available for this user.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArtifactTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={2600} onClose={() => setSnack("")} message={snack} />
    </Stack>
  );
}
