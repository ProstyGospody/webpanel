"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Plus, QrCode, Settings, Trash2, Users, Waves } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Client, Hy2Account } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField, TextField, TextareaField } from "@/components/app/fields";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { OverflowMenu } from "@/components/overflow-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Hy2Overview = {
  enabled_accounts: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

type Hy2ClientParams = {
  server?: string;
  port?: number;
  sni?: string;
  insecure?: boolean;
  pinSHA256?: string;
  obfsType?: string;
  obfsPassword?: string;
};

type Hy2AccountViewPayload = {
  account: Hy2Account;
  uri: string;
  uri_v2rayng?: string;
  singbox_outbound?: Record<string, unknown>;
  client_params?: Hy2ClientParams;
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
  { href: "/hysteria/settings", label: "Settings", icon: Settings },
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

  const [uriOpen, setURIOpen] = useState(false);
  const [uriTitle, setURITitle] = useState("");
  const [uriValue, setURIValue] = useState("");
  const [uriV2Ray, setURIV2Ray] = useState("");
  const [uriClientParams, setURIClientParams] = useState<Hy2ClientParams | null>(null);

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
      setURITitle(account.client_name || account.hy2_identity);
      setURIValue(payload.uri);
      setURIV2Ray(payload.uri_v2rayng || "");
      setURIClientParams(payload.client_params || null);
      setURIOpen(true);
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
      push("URI copied", "success");
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
        description="Manage Hysteria users, identity payloads and generated client URIs in one flow."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Create user
          </Button>
        }
      />

      <SectionNav items={tabs} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enabled" value={String(overview?.enabled_accounts ?? 0)} />
        <MetricCard label="Online" value={String(overview?.online_count ?? 0)} />
        <MetricCard label="Total TX" value={formatBytes(overview?.total_tx_bytes ?? 0)} />
        <MetricCard label="Total RX" value={formatBytes(overview?.total_rx_bytes ?? 0)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Edit is the primary action. QR/copy/delete are grouped in row actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState title="No Hysteria users" description="Create the first user to issue access credentials." icon={Waves} />
          ) : (
            <>
              <div className="hidden md:block">
                <Table className="min-w-[900px] table-fixed">
                  <colgroup>
                    <col className="w-[33%]" />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Traffic</TableHead>
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
                          <TableCell className="align-top">
                            <div className="font-medium leading-5">{item.client_name || item.hy2_identity}</div>
                            <div className="mt-1 whitespace-normal break-all text-xs text-muted-foreground">Identity: {item.hy2_identity}</div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge tone={item.is_enabled ? "success" : "danger"}>{item.is_enabled ? "Enabled" : "Disabled"}</StatusBadge>
                              <StatusBadge tone={onlineTone(online)}>{online ? "Online" : "Offline"}</StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="text-xs leading-5 text-muted-foreground">
                              <div>TX: {formatBytes(item.last_tx_bytes || 0)}</div>
                              <div>RX: {formatBytes(item.last_rx_bytes || 0)}</div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs text-muted-foreground">{formatDate(item.last_seen_at)}</TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(item)} disabled={busy}>
                                Edit
                              </Button>
                              <OverflowMenu
                                items={[
                                  {
                                    id: "qr",
                                    label: "Show QR",
                                    icon: QrCode,
                                    disabled: busy,
                                    onSelect: () => {
                                      void openQR(item);
                                    },
                                  },
                                  {
                                    id: "copy",
                                    label: copiedKey === `uri-${item.id}` ? "URI copied" : "Copy URI",
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
              </div>

              <div className="grid gap-3 md:hidden">
                {accounts.map((item) => {
                  const online = (item.online_count || 0) > 0;
                  const busy = busyID === item.id;

                  return (
                    <article key={item.id} className="space-y-3 rounded-xl border bg-muted/20 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">{item.client_name || item.hy2_identity}</h3>
                        <p className="text-xs break-all text-muted-foreground">Identity: {item.hy2_identity}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={item.is_enabled ? "success" : "danger"}>{item.is_enabled ? "Enabled" : "Disabled"}</StatusBadge>
                        <StatusBadge tone={onlineTone(online)}>{online ? "Online" : "Offline"}</StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">TX: {formatBytes(item.last_tx_bytes || 0)} | RX: {formatBytes(item.last_rx_bytes || 0)}</p>
                      <p className="text-xs text-muted-foreground">Last seen: {formatDate(item.last_seen_at)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(item)} disabled={busy}>
                          Edit
                        </Button>
                        <OverflowMenu
                          items={[
                            {
                              id: "qr",
                              label: "Show QR",
                              icon: QrCode,
                              disabled: busy,
                              onSelect: () => {
                                void openQR(item);
                              },
                            },
                            {
                              id: "copy",
                              label: copiedKey === `uri-${item.id}` ? "URI copied" : "Copy URI",
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
                    </article>
                  );
                })}
              </div>
            </>
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
            description="Optional custom auth payload."
          />

          <TextField
            label="Identity"
            value={formState.hy2_identity}
            onChange={(event) => setFormState((prev) => ({ ...prev, hy2_identity: event.target.value }))}
            placeholder="Auto-generated if empty"
            description="Client identity visible in runtime logs."
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

      <Dialog
        open={uriOpen}
        title={`Connection: ${uriTitle}`}
        onClose={() => setURIOpen(false)}
        size="lg"
        actions={
          <>
            <Button variant="ghost" type="button" onClick={() => void copyValue(uriValue, "uri")}> 
              {copiedKey === "uri" ? "Copied" : "Copy URI"}
            </Button>
            {uriV2Ray && (
              <Button variant="ghost" type="button" onClick={() => void copyValue(uriV2Ray, "uri-v2")}> 
                {copiedKey === "uri-v2" ? "Copied" : "Copy hy2://"}
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-3">
          <TextareaField label="hysteria2 URI" value={uriValue} readOnly className="font-mono text-xs" />

          {uriV2Ray && <TextareaField label="V2RayNG hy2 URI" value={uriV2Ray} readOnly className="font-mono text-xs" />}

          {uriClientParams && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              <div>
                server: {uriClientParams.server || "-"} | port: {uriClientParams.port || "-"} | sni: {uriClientParams.sni || "-"}
              </div>
            </div>
          )}

          {uriValue && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(uriValue)}`}
              alt="Hysteria QR code"
              className="h-56 w-56 rounded-xl object-contain"
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-[11px] font-semibold tracking-[0.08em] uppercase">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

