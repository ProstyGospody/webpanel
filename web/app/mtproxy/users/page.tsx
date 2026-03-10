"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, QrCode, Send, Trash2, Users } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, MTProxySecret } from "@/lib/types";
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

type MTOverview = {
  enabled_secrets: number;
  connections_total?: number | null;
  users_total?: number | null;
};

type MTListPayload = {
  items: MTProxySecret[];
  runtime_secret_id?: string;
};

type MTSecretPayload = {
  secret: MTProxySecret;
  tg_link: string;
  runtime_secret_id?: string;
};

type FormState = {
  client_id: string;
  label: string;
  secret: string;
};

type FormErrors = {
  client_id?: string;
};

const POLL_INTERVAL_MS = 10000;

const tabs = [
  { href: "/mtproxy/users", label: "Users", icon: Users },
  { href: "/mtproxy/settings", label: "Settings", icon: Send },
];

export default function MTProxyUsersPage() {
  const { push } = useToast();

  const [secrets, setSecrets] = useState<MTProxySecret[]>([]);
  const [overview, setOverview] = useState<MTOverview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [editing, setEditing] = useState<MTProxySecret | null>(null);
  const [formState, setFormState] = useState<FormState>({ client_id: "", label: "", secret: "" });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleting, setDeleting] = useState<MTProxySecret | null>(null);

  const [qrOpen, setQROpen] = useState(false);
  const [qrTitle, setQRTitle] = useState("");
  const [qrSecretID, setQRSecretID] = useState("");
  const [linkValue, setLinkValue] = useState("");

  const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);

  function markCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
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
      const [secretsResp, overviewResp, clientsResp] = await Promise.all([
        apiFetch<MTListPayload>("/api/mtproxy/secrets?limit=500"),
        apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
        apiFetch<{ items: Client[] }>("/api/clients?limit=500"),
      ]);

      setSecrets(secretsResp.items || []);
      setOverview(overviewResp);
      setClients(clientsResp.items || []);

      if (!formState.client_id && clientsResp.items && clientsResp.items.length > 0) {
        setFormState((prev) => ({ ...prev, client_id: clientsResp.items![0].id }));
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MTProxy users");
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
      label: "",
      secret: "",
    }));
    setFormOpen(true);
  }

  function openEdit(secret: MTProxySecret) {
    setEditing(secret);
    setFormErrors({});
    setFormState({
      client_id: secret.client_id,
      label: secret.label || "",
      secret: secret.secret,
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
        await apiFetch(`/api/mtproxy/secrets/${editing.id}`, {
          method: "PATCH",
          body: toJSONBody({
            label: formState.label || null,
            secret: formState.secret || null,
          }),
        });
        push("User updated", "success");
      } else {
        await apiFetch("/api/mtproxy/secrets", {
          method: "POST",
          body: toJSONBody({
            client_id: formState.client_id,
            label: formState.label || null,
            secret: formState.secret || null,
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

  function askDelete(secret: MTProxySecret) {
    setDeleting(secret);
    setDeleteOpen(true);
  }

  async function removeSecret() {
    if (!deleting) {
      return;
    }
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/mtproxy/secrets/${deleting.id}`, {
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

  async function openQR(secret: MTProxySecret) {
    setBusyID(secret.id);
    try {
      const payload = await apiFetch<MTSecretPayload>(`/api/mtproxy/secrets/${secret.id}`);
      setQRTitle(secret.label || secret.client_name || secret.client_id);
      setQRSecretID(secret.id);
      setLinkValue(payload.tg_link);
      setQROpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load connection link";
      setError(message);
      push(message, "error");
    } finally {
      setBusyID((current) => (current === secret.id ? null : current));
    }
  }

  async function copyTelegramLink(secret: MTProxySecret) {
    setBusyID(secret.id);
    try {
      const payload = await apiFetch<MTSecretPayload>(`/api/mtproxy/secrets/${secret.id}`);
      await copyToClipboard(payload.tg_link);
      markCopied(`tg-${secret.id}`);
      push("Link copied", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to copy link";
      setError(message);
      push(message, "error");
    } finally {
      setBusyID((current) => (current === secret.id ? null : current));
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
        title="MTProxy"
        icon={<Send />}
        description="Manage MTProxy users and connection links."
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Enabled" value={String(overview?.enabled_secrets ?? 0)} loading={loading} />
        <StatCard label="Connections" value={String(overview?.connections_total ?? 0)} loading={loading} />
        <StatCard label="Users" value={String(overview?.users_total ?? 0)} loading={loading} />
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
          ) : secrets.length === 0 ? (
            <EmptyState title="No MTProxy users" description="Create the first secret to activate MTProxy access." icon={Send} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Runtime</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {secrets.map((item) => {
                  const busy = busyID === item.id;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.label || item.client_name || item.client_id}</div>
                        <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">Secret: {item.secret}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={item.is_enabled ? "success" : "danger"}>{item.is_enabled ? "Enabled" : "Disabled"}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={item.is_runtime_active ? "success" : "neutral"}>{item.is_runtime_active ? "Active" : "Standby"}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(item.last_seen_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void openQR(item)} disabled={busy}>
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
                                label: copiedKey === `tg-${item.id}` ? "Link copied" : "Copy link",
                                icon: Copy,
                                disabled: busy,
                                onSelect: () => {
                                  void copyTelegramLink(item);
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
        title={editing ? "Edit MTProxy user" : "Create MTProxy user"}
        onClose={closeForm}
        actions={
          <>
            <Button variant="ghost" type="button" onClick={closeForm} disabled={formBusy}>
              Cancel
            </Button>
            <Button type="submit" form="mtproxy-user-form" disabled={formBusy}>
              {formBusy ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <form id="mtproxy-user-form" className="grid gap-4 md:grid-cols-2" onSubmit={submitForm} noValidate>
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
            label="Label"
            value={formState.label}
            onChange={(event) => setFormState((prev) => ({ ...prev, label: event.target.value }))}
          />

          <TextField
            label="Secret"
            value={formState.secret}
            onChange={(event) => setFormState((prev) => ({ ...prev, secret: event.target.value }))}
            placeholder="Auto-generated if empty"
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete user"
        description={`Delete ${deleting?.label || deleting?.client_name || "this user"}? This action cannot be undone.`}
        confirmLabel="Delete"
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeSecret}
        busy={deleteBusy}
      />

      <Dialog open={qrOpen} title={qrTitle || "Connection QR"} onClose={() => setQROpen(false)} size="sm">
        <div className="space-y-2">
          <div className="flex justify-center">
            {qrSecretID && linkValue ? (
              <button
                type="button"
                onClick={() => void copyValue(linkValue, "tg-link")}
                className="rounded-xl border bg-background p-2 transition-colors hover:bg-muted/40"
                aria-label="Copy connection link"
              >
                <img
                  src={`/api/mtproxy/secrets/${qrSecretID}/qr?size=360`}
                  alt="MTProxy connection QR"
                  className="h-64 w-64 rounded-lg bg-white p-2 object-contain"
                />
              </button>
            ) : (
              <Skeleton className="h-64 w-64 rounded-lg" />
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

