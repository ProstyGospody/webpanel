"use client";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Fab,
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
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { ClientArtifactsDialog } from "@/components/dialogs/client-artifacts-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { defaultsSummary, downloadClientConfig, toCreateRequest, toUpdateRequest, type ClientFormValues } from "@/domain/clients/adapters";
import {
  createClient,
  deleteClient,
  getClientArtifacts,
  getClientDefaults,
  listClients,
  setClientEnabled,
  updateClient,
} from "@/domain/clients/services";
import { HysteriaClient, HysteriaClientDefaults, HysteriaUserPayload } from "@/domain/clients/types";
import { APIError } from "@/services/api";
import { formatBytes, formatDateTime } from "@/utils/format";
import { useNotice } from "@/hooks/use-notice";

export default function UsersPage() {
  const [clients, setClients] = useState<HysteriaClient[]>([]);
  const [defaults, setDefaults] = useState<HysteriaClientDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingClient, setEditingClient] = useState<HysteriaClient | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<HysteriaClient | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [artifactOpen, setArtifactOpen] = useState(false);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactTab, setArtifactTab] = useState<"qr" | "details">("qr");
  const [artifactClient, setArtifactClient] = useState<HysteriaClient | null>(null);
  const [artifactPayload, setArtifactPayload] = useState<HysteriaUserPayload | null>(null);

  const notice = useNotice();

  const inheritedText = useMemo(() => defaultsSummary(defaults), [defaults]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [items, inherited] = await Promise.all([listClients(), getClientDefaults()]);
      setClients(items);
      setDefaults(inherited);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormMode("create");
    setEditingClient(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(client: HysteriaClient) {
    setFormMode("edit");
    setEditingClient(client);
    setFormError("");
    setFormOpen(true);
  }

  async function submitForm(values: ClientFormValues) {
    setFormBusy(true);
    setFormError("");
    try {
      if (formMode === "create") {
        await createClient(toCreateRequest(values));
        notice.notify("Client created");
      } else if (editingClient) {
        await updateClient(editingClient.id, toUpdateRequest(values));
        notice.notify("Client updated");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to save client";
      setFormError(message);
    } finally {
      setFormBusy(false);
    }
  }

  async function removeClient() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      notice.notify("Client deleted");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to delete client");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function toggleEnabled(client: HysteriaClient) {
    try {
      await setClientEnabled(client.id, !client.enabled);
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to change state");
    }
  }

  async function openArtifacts(client: HysteriaClient, tab: "qr" | "details") {
    setArtifactClient(client);
    setArtifactTab(tab);
    setArtifactOpen(true);
    setArtifactLoading(true);
    try {
      const payload = await getClientArtifacts(client.id);
      setArtifactPayload(payload);
    } catch (err) {
      setArtifactPayload(null);
      setError(err instanceof APIError ? err.message : "Failed to load artifacts");
    } finally {
      setArtifactLoading(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notice.notify("Copied");
    } catch {
      setError("Clipboard write failed");
    }
  }

  function download() {
    const artifacts = artifactPayload?.artifacts;
    const username = artifactPayload?.user.username;
    if (!artifacts?.client_config || !username) return;
    downloadClientConfig(username, artifacts.client_config);
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Clients"
        subtitle={inheritedText}
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>
              Reload
            </Button>
            <Fab color="primary" size="medium" aria-label="create client" onClick={openCreate}>
              <AddRoundedIcon />
            </Fab>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">Loading clients...</Typography>
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Traffic</TableCell>
                    <TableCell>Last Seen</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Box sx={{ cursor: "pointer" }} onClick={() => void openArtifacts(client, "details")}>
                            <Typography sx={{ fontWeight: 700 }}>{client.username}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">{client.note || "-"}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch size="small" checked={client.enabled} onChange={() => void toggleEnabled(client)} />
                          <StatusChip status={client.enabled ? "enabled" : "disabled"} />
                        </Stack>
                      </TableCell>
                      <TableCell>{formatBytes(client.last_tx_bytes + client.last_rx_bytes)}</TableCell>
                      <TableCell>{formatDateTime(client.last_seen_at || client.updated_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Show QR">
                            <span>
                              <IconButton size="small" onClick={() => void openArtifacts(client, "qr")} disabled={!client.enabled}>
                                <QrCode2RoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(client)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(client)}>
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

      <ClientFormDialog
        open={formOpen}
        mode={formMode}
        busy={formBusy}
        client={editingClient}
        defaults={defaults}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete client"
        description={`Delete ${deleteTarget?.username || "client"} and remove access?`}
        busy={deleteBusy}
        confirmText="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void removeClient()}
      />

      <ClientArtifactsDialog
        open={artifactOpen}
        tab={artifactTab}
        client={artifactClient}
        payload={artifactPayload}
        loading={artifactLoading}
        onClose={() => setArtifactOpen(false)}
        onCopy={(value) => void copy(value)}
        onDownload={download}
      />

      <Snackbar open={Boolean(notice.message)} autoHideDuration={2600} onClose={notice.clear} message={notice.message} />
    </Stack>
  );
}
