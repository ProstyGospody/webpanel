"use client";

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ClientArtifactsDialog } from "@/components/dialogs/client-artifacts-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { PageHeader } from "@/components/ui/page-header";
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

type ClientFilter = "all" | "online" | "enabled" | "disabled";

const rowsPerPageOptions = [10, 25, 50, 100];

export default function UsersPage() {
  const [clients, setClients] = useState<HysteriaClient[]>([]);
  const [defaults, setDefaults] = useState<HysteriaClientDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedClientIDs, setSelectedClientIDs] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingClient, setEditingClient] = useState<HysteriaClient | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<HysteriaClient | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

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
      setError(err instanceof APIError ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, filter]);

  useEffect(() => {
    const existing = new Set(clients.map((client) => client.id));
    setSelectedClientIDs((current) => current.filter((id) => existing.has(id)));
  }, [clients]);

  const filteredClients = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return [...clients]
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }))
      .filter((client) => {
        if (filter === "online" && client.online_count <= 0) {
          return false;
        }
        if (filter === "enabled" && !client.enabled) {
          return false;
        }
        if (filter === "disabled" && client.enabled) {
          return false;
        }

        if (!needle) {
          return true;
        }

        const haystack = [client.username, client.username_normalized, client.note || "", client.id].join(" ").toLowerCase();
        return haystack.includes(needle);
      });
  }, [clients, filter, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedClientIDs), [selectedClientIDs]);
  const filteredIDs = useMemo(() => filteredClients.map((client) => client.id), [filteredClients]);
  const selectedFilteredCount = useMemo(() => filteredIDs.reduce((sum, id) => sum + (selectedSet.has(id) ? 1 : 0), 0), [filteredIDs, selectedSet]);

  const allFilteredSelected = filteredIDs.length > 0 && selectedFilteredCount === filteredIDs.length;
  const someFilteredSelected = selectedFilteredCount > 0 && !allFilteredSelected;

  const pagedClients = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredClients.slice(start, start + rowsPerPage);
  }, [filteredClients, page, rowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredClients.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredClients.length, page, rowsPerPage]);

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
        notice.notify("User created");
      } else if (editingClient) {
        await updateClient(editingClient.id, toUpdateRequest(values));
        notice.notify("User updated");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to save user";
      setFormError(message);
    } finally {
      setFormBusy(false);
    }
  }

  async function removeClient() {
    if (!deleteTarget) {
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      notice.notify("User deleted");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to delete user");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function deleteSelectedClients() {
    if (!selectedClientIDs.length) {
      return;
    }

    const targetIDs = [...selectedClientIDs];
    const failedIDs: string[] = [];
    let firstError = "";
    let deletedCount = 0;

    setBulkDeleteBusy(true);
    setError("");
    try {
      for (const id of targetIDs) {
        try {
          await deleteClient(id);
          deletedCount += 1;
        } catch (err) {
          failedIDs.push(id);
          if (!firstError) {
            firstError = err instanceof APIError ? err.message : "Failed to delete selected users";
          }
        }
      }

      if (deletedCount > 0) {
        notice.notify(deletedCount === 1 ? "1 user deleted" : `${deletedCount} users deleted`);
      }

      if (failedIDs.length > 0) {
        setSelectedClientIDs(failedIDs);
        setError(firstError || `Deleted ${deletedCount} of ${targetIDs.length} users`);
      } else {
        setSelectedClientIDs([]);
      }
    } finally {
      setBulkDeleteBusy(false);
      setBulkDeleteOpen(false);
      await load();
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
      notice.notify("Copied");
    } catch {
      setError("Clipboard write failed");
    }
  }

  function toggleClientSelection(clientID: string, checked: boolean) {
    setSelectedClientIDs((current) => {
      if (checked) {
        if (current.includes(clientID)) {
          return current;
        }
        return [...current, clientID];
      }
      return current.filter((id) => id !== clientID);
    });
  }

  function toggleSelectFiltered(checked: boolean) {
    if (checked) {
      setSelectedClientIDs((current) => {
        const next = new Set(current);
        for (const id of filteredIDs) {
          next.add(id);
        }
        return Array.from(next);
      });
      return;
    }

    const filteredSet = new Set(filteredIDs);
    setSelectedClientIDs((current) => current.filter((id) => !filteredSet.has(id)));
  }

  function handleFilterChange(_event: MouseEvent<HTMLElement>, next: ClientFilter | null) {
    if (next) {
      setFilter(next);
    }
  }

  function handleRowsPerPageChange(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    setRowsPerPage(parsed);
    setPage(0);
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Users"
        actions={
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="nowrap"
            justifyContent="flex-end"
            sx={{ width: "100%", minWidth: 0 }}
          >
            <Button
              variant="text"
              onClick={openCreate}
              aria-label="Add user"
              sx={(theme) => ({
                minWidth: 42,
                width: 42,
                height: 42,
                p: 0,
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.34)}`,
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontWeight: 800,
                fontSize: "1.25rem",
                lineHeight: 1,
                flexShrink: 0,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
              })}
            >
              +
            </Button>

            <Tooltip title={`Delete selected (${selectedClientIDs.length})`}>
              <span>
                <IconButton
                  disabled={!selectedClientIDs.length}
                  onClick={() => setBulkDeleteOpen(true)}
                  aria-label="Delete selected users"
                  sx={(theme) => ({
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    border: `1px solid ${alpha(theme.palette.error.main, 0.34)}`,
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.mode === "light" ? theme.palette.error.dark : theme.palette.error.light,
                    flexShrink: 0,
                    "&:hover": {
                      backgroundColor: theme.palette.error.main,
                      color: theme.palette.error.contrastText,
                      borderColor: alpha(theme.palette.error.main, 0.44),
                    },
                    "&.Mui-disabled": {
                      color: alpha(theme.palette.error.main, 0.46),
                      borderColor: alpha(theme.palette.error.main, 0.22),
                      backgroundColor: theme.palette.background.paper,
                    },
                  })}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>

            <TextField
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              size="small"
              sx={(theme) => ({
                minWidth: { xs: 140, sm: 180 },
                width: { xs: "100%", sm: 220, lg: 250 },
                maxWidth: { xs: "100%", sm: 250 },
                flex: { xs: "1 1 160px", sm: "0 0 220px", lg: "0 0 250px" },
                "& .MuiOutlinedInput-root": {
                  height: 42,
                  borderRadius: 999,
                  backgroundColor: alpha(theme.palette.primary.main, 0.07),
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha(theme.palette.primary.main, 0.34),
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha(theme.palette.primary.main, 0.48),
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 1,
                  },
                },
                "& .MuiInputBase-input::placeholder": {
                  color: alpha(theme.palette.text.secondary, 0.78),
                  opacity: 1,
                },
                "& .MuiInputAdornment-root .MuiSvgIcon-root": {
                  color: alpha(theme.palette.text.secondary, 0.78),
                },
              })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <ToggleButtonGroup
              exclusive
              value={filter}
              onChange={handleFilterChange}
              size="small"
              sx={(theme) => ({
                flexShrink: 0,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.34)}`,
                borderRadius: 999,
                p: 0.35,
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                "& .MuiToggleButtonGroup-grouped": {
                  border: 0,
                  borderRadius: 999,
                  px: 1.8,
                  textTransform: "none",
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                },
                "& .MuiToggleButtonGroup-grouped.Mui-selected": {
                  color: theme.palette.primary.contrastText,
                  backgroundColor: theme.palette.primary.main,
                },
                "& .MuiToggleButtonGroup-grouped.Mui-selected:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
              })}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="online">Online</ToggleButton>
              <ToggleButton value="enabled">Enabled</ToggleButton>
              <ToggleButton value="disabled">Disabled</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 8, px: 2 }} spacing={1.5}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">Loading users...</Typography>
            </Stack>
          ) : (
            <Stack spacing={0}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {filteredClients.length} users
                </Typography>
              </Stack>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={someFilteredSelected}
                          onChange={(event) => toggleSelectFiltered(event.target.checked)}
                          inputProps={{ "aria-label": "select filtered users" }}
                        />
                      </TableCell>
                      <TableCell>#</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Online</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Traffic</TableCell>
                      <TableCell>Last Seen</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedClients.length ? (
                      pagedClients.map((client, index) => (
                        <TableRow key={client.id} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedSet.has(client.id)}
                              onChange={(event) => toggleClientSelection(client.id, event.target.checked)}
                              inputProps={{ "aria-label": `select ${client.username}` }}
                            />
                          </TableCell>
                          <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                          <TableCell>
                            <Stack spacing={0.25}>
                              <Box sx={{ cursor: "pointer" }} onClick={() => void openArtifacts(client)}>
                                <Typography sx={{ fontWeight: 700 }}>{client.username}</Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary">{client.note || "-"}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography
                              sx={(theme) => ({
                                color: client.online_count > 0 ? theme.palette.success.main : theme.palette.text.secondary,
                                fontWeight: 700,
                              })}
                            >
                              {client.online_count > 0 ? "Online" : "Offline"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Switch size="small" checked={client.enabled} onChange={() => void toggleEnabled(client)} />
                              <StatusChip status={client.enabled ? "enabled" : "disabled"} />
                            </Stack>
                          </TableCell>
                          <TableCell>{formatBytes(client.last_tx_bytes + client.last_rx_bytes)}</TableCell>
                          <TableCell>{formatDateTime(client.last_seen_at || client.updated_at, { includeSeconds: false })}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="Show QR">
                                <span>
                                  <IconButton size="small" onClick={() => void openArtifacts(client)} disabled={!client.enabled}>
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
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            {clients.length ? "No users match the current filters." : "No users yet."}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filteredClients.length}
                page={page}
                onPageChange={(_event, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={rowsPerPageOptions}
                onRowsPerPageChange={(event) => handleRowsPerPageChange(event.target.value)}
                sx={{ px: 0.5 }}
              />
            </Stack>
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
        title="Delete user"
        description={`Delete ${deleteTarget?.username || "user"} and remove access?`}
        busy={deleteBusy}
        confirmText="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void removeClient()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected users"
        description={`Delete ${selectedClientIDs.length} selected users and remove access?`}
        busy={bulkDeleteBusy}
        confirmText="Delete selected"
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void deleteSelectedClients()}
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
