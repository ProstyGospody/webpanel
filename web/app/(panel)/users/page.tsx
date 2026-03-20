"use client";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Button,
  Chip,
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

import { ClientArtifactsDialog } from "@/components/dialogs/client-artifacts-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState, LoadingState } from "@/components/ui/state-message";
import { StatusChip } from "@/components/ui/status-chip";
import { toCreateRequest, toUpdateRequest, type ClientFormValues } from "@/domain/clients/adapters";
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
import { useNotice } from "@/hooks/use-notice";
import { APIError } from "@/services/api";
import { formatBytes, formatDateTime } from "@/utils/format";

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
  const [artifactClient, setArtifactClient] = useState<HysteriaClient | null>(null);
  const [artifactPayload, setArtifactPayload] = useState<HysteriaUserPayload | null>(null);

  const notice = useNotice();

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

  const stats = useMemo(() => {
    const enabled = clients.filter((client) => client.enabled).length;
    const online = clients.reduce((sum, client) => sum + (client.online_count || 0), 0);
    return { total: clients.length, enabled, online };
  }, [clients]);

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
      setFormError(err instanceof APIError ? err.message : "Failed to save client");
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

  async function openArtifacts(client: HysteriaClient) {
    setArtifactClient(client);
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
      notice.notify("Copied to clipboard");
    } catch {
      setError("Clipboard write failed");
    }
  }

  return (
    <Stack spacing={2.25}>
      <PageHeader
        title="Clients"
        subtitle="Manage access identities, states, and connection artifacts"
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>
              Reload
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              New Client
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip variant="outlined" label={`Total: ${stats.total}`} />
        <Chip variant="outlined" color="success" label={`Enabled: ${stats.enabled}`} />
        <Chip variant="outlined" color="primary" label={`Online sessions: ${stats.online}`} />
        <Chip variant="outlined" label={`Defaults: ${defaults ? "Loaded" : "Unavailable"}`} color={defaults ? "success" : "warning"} />
      </Stack>

      <SectionCard title="Client Access Directory" subtitle="Operational table with direct actions and status switches">
        {loading ? (
          <LoadingState message="Loading clients..." minHeight={320} />
        ) : clients.length === 0 ? (
          <EmptyState title="No clients yet" description="Create a client to issue active access artifacts." />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Upload</TableCell>
                  <TableCell align="right">Download</TableCell>
                  <TableCell align="right">Online</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Button
                          variant="text"
                          color="inherit"
                          sx={{ justifyContent: "flex-start", px: 0, minWidth: 0, fontWeight: 700 }}
                          onClick={() => void openArtifacts(client)}
                        >
                          {client.username}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          {client.note || "No note"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Switch size="small" checked={client.enabled} onChange={() => void toggleEnabled(client)} />
                        <StatusChip status={client.enabled ? "enabled" : "disabled"} />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{formatBytes(client.last_tx_bytes || 0)}</TableCell>
                    <TableCell align="right">{formatBytes(client.last_rx_bytes || 0)}</TableCell>
                    <TableCell align="right">{client.online_count || 0}</TableCell>
                    <TableCell>{formatDateTime(client.last_seen_at || client.updated_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Open artifacts">
                          <span>
                            <IconButton size="small" onClick={() => void openArtifacts(client)} disabled={!client.enabled}>
                              <QrCode2RoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Edit client">
                          <IconButton size="small" onClick={() => openEdit(client)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete client">
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
      </SectionCard>

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
        description={`Delete ${deleteTarget?.username || "client"} and revoke access immediately?`}
        busy={deleteBusy}
        confirmText="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void removeClient()}
      />

      <ClientArtifactsDialog
        open={artifactOpen}
        client={artifactClient}
        payload={artifactPayload}
        loading={artifactLoading}
        onClose={() => setArtifactOpen(false)}
        onCopy={(value) => void copy(value)}
      />

      <Snackbar open={Boolean(notice.message)} autoHideDuration={2600} onClose={notice.clear} message={notice.message} />
    </Stack>
  );
}
