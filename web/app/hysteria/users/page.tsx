"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, QrCode, Trash2, Users, Zap } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Client, Hy2Account } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SectionNav } from "@/components/app/section-nav";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField, TextField } from "@/components/app/fields";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { OverflowMenu } from "@/components/overflow-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Hy2Overview = {
  enabled_accounts: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

type Hy2AccountViewPayload = {
  account: Hy2Account;
  uri: string;
};

type AccountFormState = {
  client_id: string;
  auth_payload: string;
  hy2_identity: string;
};

type FormErrors = {
  client_id?: string;
};

const POLL_INTERVAL_MS = 10000;

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Zap },
];

function onlineTone(online: boolean): "success" | "neutral" {
  return online ? "success" : "neutral";
}

export default function HysteriaUsersPage() {
  const { push } = useToast();

  const [accounts, setAccounts] = useState<Hy2Account[]>([]);
  const [overview, setOverview] = useState<Hy2Overview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyID, setBusyID] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [editing, setEditing] = useState<Hy2Account | null>(null);
  const [formState, setFormState] = useState<AccountFormState>({
    client_id: "",
    auth_payload: "",
    hy2_identity: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleting, setDeleting] = useState<Hy2Account | null>(null);

  const [qrOpen, setQROpen] = useState(false);
  const [qrTitle, setQRTitle] = useState("");
  const [qrAccountID, setQRAccountID] = useState("");
  const [uriValue, setURIValue] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);

  function markCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1500);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormErrors({});
  }

  async function load(showLoader = false) {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const [accountsResp, overviewResp, clientsResp] = await Promise.all([
        apiFetch<{ items: Hy2Account[] }>("/api/hy2/accounts?limit=500"),
        apiFetch<Hy2Overview>("/api/hy2/stats/overview"),
        apiFetch<{ items: Client[] }>("/api/clients?limit=500"),
      ]);

      setAccounts(accountsResp.items || []);
      setOverview(overviewResp);
      setClients(clientsResp.items || []);

      if (!formState.client_id && clientsResp.items && clientsResp.items.length > 0) {
        setFormState((prev) => ({ ...prev, client_id: clientsResp.items![0].id }));
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Hysteria users");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    load(true).catch(() => {
      // handled in load
    });

    const timer = window.setInterval(() => {
      if (!cancelled) {
        load(false).catch(() => {
          // handled in load
        });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setFormErrors({});
    setFormState((prev) => ({
      client_id: prev.client_id || sortedClients[0]?.id || "",
      auth_payload: "",
      hy2_identity: "",
    }));
    setFormOpen(true);
  }

  function openEdit(account: Hy2Account) {
    setEditing(account);
    setFormErrors({});
    setFormState({
      client_id: account.client_id,
      auth_payload: account.auth_payload,
      hy2_identity: account.hy2_identity,
    });
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();

    if (!formState.client_id) {
      setFormErrors({ client_id: "Client is required." });
      return;
    }

    setFormErrors({});
    setFormBusy(true);
    try {
      if (editing) {
        await apiFetch(`/api/hy2/accounts/${editing.id}`, {
          method: "PATCH",
          body: toJSONBody({
            auth_payload: formState.auth_payload,
            hy2_identity: formState.hy2_identity,
          }),
        });
        push("User updated", "success");
      } else {
        await apiFetch("/api/hy2/accounts", {
          method: "POST",
          body: toJSONBody({
            client_id: formState.client_id,
            auth_payload: formState.auth_payload || null,
            hy2_identity: formState.hy2_identity || null,
          }),
        });
        push("User created", "success");
      }

      closeForm();
      await load(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save user";
      setError(message);
      push(message, "error");
    } finally {
      setFormBusy(false);
    }
  }

  function askDelete(account: Hy2Account) {
    setDeleting(account);
    setDeleteOpen(true);
  }

  async function removeUser() {
    if (!deleting) {
      return;
    }
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/hy2/accounts/${deleting.id}`, {
        method: "DELETE",
        body: toJSONBody({}),
      });
      push("User deleted", "success");
      setDeleteOpen(false);
      setDeleting(null);
      await load(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      setError(message);
      push(message, "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function openQR(account: Hy2Account) {
    setBusyID(account.id);
    try {
      const payload = await apiFetch<Hy2AccountViewPayload>(`/api/hy2/accounts/${account.id}`);
      setQRTitle(account.client_name || account.hy2_identity);
      setURIValue(payload.uri);
      setQRAccountID(account.id);
      setQROpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load URI";
      setError(message);
      push(message, "error");
    } finally {
      setBusyID((current) => (current === account.id ? null : current));
    }
  }

  async function copyURI(account: Hy2Account) {
    setBusyID(account.id);
    try {
      const payload = await apiFetch<Hy2AccountViewPayload>(`/api/hy2/accounts/${account.id}`);
      await copyToClipboard(payload.uri);
      markCopied(`uri-${account.id}`);
      push("Link copied", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to copy URI";
      setError(message);
      push(message, "error");
    } finally {
      setBusyID((current) => (current === account.id ? null : current));
    }
  }

  async function copyValue(value: string, key: string) {
    try {
      await copyToClipboard(value);
      markCopied(key);
      push("Copied", "success");
    } catch {
      push("Copy failed", "error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hysteria"
        icon={<Zap />}
        description="Manage Hysteria users and connection credentials."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Create user
          </Button>
        }
      />

      <SectionNav items={tabs} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enabled" value={String(overview?.enabled_accounts ?? 0)} loading={loading} />
        <StatCard label="Online" value={String(overview?.online_count ?? 0)} loading={loading} />
        <StatCard label="Upload" value={formatBytes(overview?.total_tx_bytes ?? 0)} loading={loading} />
        <StatCard label="Download" value={formatBytes(overview?.total_rx_bytes ?? 0)} loading={loading} />
      </section>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState title="No Hysteria users" description="Create the first user to issue access credentials." icon={Zap} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((item) => {
                  const online = (item.online_count || 0) > 0;
                  const busy = busyID === item.id;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.client_name || item.hy2_identity}</div>
                        <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">ID: {item.hy2_identity}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge tone={item.is_enabled ? "success" : "danger"}>{item.is_enabled ? "Enabled" : "Disabled"}</StatusBadge>
                          <StatusBadge tone={onlineTone(online)}>{online ? "Online" : "Offline"}</StatusBadge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        Upload: {formatBytes(item.last_tx_bytes || 0)} | Download: {formatBytes(item.last_rx_bytes || 0)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(item.last_seen_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => void openQR(item)} disabled={busy}>
                            <QrCode className="size-4" />
                            Show QR
                          </Button>
                          <OverflowMenu
                            items={[
                              {
                                id: "edit",
                                label: "Edit",
                                icon: Pencil,
                                disabled: busy,
                                onSelect: () => openEdit(item),
                              },
                              {
                                id: "copy",
                                label: copiedKey === `uri-${item.id}` ? "Link copied" : "Copy link",
                                icon: Copy,
                                disabled: busy,
                                onSelect: () => {
                                  void copyURI(item);
                                },
                              },
                              {
                                id: "delete",
                                label: "Delete",
                                icon: Trash2,
                                destructive: true,
                                disabled: busy,
                                onSelect: () => askDelete(item),
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        title={editing ? "Edit Hysteria user" : "Create Hysteria user"}
        onClose={closeForm}
        actions={
          <>
            <Button variant="ghost" type="button" onClick={closeForm} disabled={formBusy}>
              Cancel
            </Button>
            <Button type="submit" form="hy2-user-form" disabled={formBusy}>
              {formBusy ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <form id="hy2-user-form" className="grid gap-4 md:grid-cols-2" onSubmit={submitForm} noValidate>
          <SelectField
            label="Client"
            value={formState.client_id}
            error={formErrors.client_id}
            onValueChange={(value) => {
              setFormState((prev) => ({ ...prev, client_id: value }));
              if (formErrors.client_id) {
                setFormErrors((prev) => ({ ...prev, client_id: undefined }));
              }
            }}
            disabled={Boolean(editing)}
            options={sortedClients.map((client) => ({ value: client.id, label: client.name }))}
          />

          <TextField
            label="Auth payload"
            value={formState.auth_payload}
            onChange={(event) => setFormState((prev) => ({ ...prev, auth_payload: event.target.value }))}
            placeholder="Auto-generated if empty"
          />

          <TextField
            label="Identity"
            value={formState.hy2_identity}
            onChange={(event) => setFormState((prev) => ({ ...prev, hy2_identity: event.target.value }))}
            placeholder="Auto-generated if empty"
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete user"
        description={`Delete ${deleting?.client_name || deleting?.hy2_identity || "this user"}? This action cannot be undone.`}
        confirmLabel="Delete"
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeUser}
        busy={deleteBusy}
      />

      <Dialog open={qrOpen} title={qrTitle || "Connection QR"} onClose={() => setQROpen(false)} size="sm">
        <div className="space-y-3">
          <div className="flex justify-center">
            {qrAccountID && uriValue ? (
              <button
                type="button"
                onClick={() => void copyValue(uriValue, "uri")}
                className="rounded-xl border bg-background p-2 transition-colors hover:bg-muted/40"
                aria-label="Copy connection link"
              >
                <img
                  src={`/api/hy2/accounts/${qrAccountID}/qr?size=360`}
                  alt="Hysteria connection QR"
                  className="h-64 w-64 rounded-lg bg-white p-2 object-contain"
                />
              </button>
            ) : (
              <Skeleton className="h-64 w-64 rounded-lg" />
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Click QR to copy link {copiedKey === "uri" ? "(copied)" : ""}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
