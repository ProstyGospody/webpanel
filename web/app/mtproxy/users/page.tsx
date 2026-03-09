"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, MTProxySecret } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  InlineMessage,
  MetricCard,
  PageHeader,
  SelectField,
  StatusBadge,
  TextField,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { useToast } from "@/components/toast-provider";
import { OverflowMenu } from "@/components/overflow-menu";
import { SectionTabs } from "@/components/section-tabs";

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
  { href: "/mtproxy/users", label: "Users", icon: "group" },
  { href: "/mtproxy/settings", label: "Settings", icon: "settings" },
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
        push("Secret updated", "success");
      } else {
        await apiFetch("/api/mtproxy/secrets", {
          method: "POST",
          body: toJSONBody({
            client_id: formState.client_id,
            label: formState.label || null,
            secret: formState.secret || null,
          }),
        });
        push("Secret created", "success");
      }

      closeForm();
      await load(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save secret";
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
      push("Secret deleted", "success");
      setDeleteOpen(false);
      setDeleting(null);
      await load(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete secret";
      setError(message);
      push(message, "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function copyTelegramLink(secret: MTProxySecret) {
    setBusyID(secret.id);
    try {
      const payload = await apiFetch<MTSecretPayload>(`/api/mtproxy/secrets/${secret.id}`);
      await copyToClipboard(payload.tg_link);
      markCopied(`tg-${secret.id}`);
      push("tg:// link copied", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to copy tg:// link";
      setError(message);
      push(message, "error");
    } finally {
      setBusyID((current) => (current === secret.id ? null : current));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MTProxy"
        subtitle="Manage proxy users with overflow actions and runtime-safe dialog workflows."
        actions={
          <Button onClick={openCreate} icon="add">
            Create user
          </Button>
        }
      />

      <SectionTabs items={tabs} />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enabled" value={String(overview?.enabled_secrets ?? 0)} />
        <MetricCard label="Connections" value={String(overview?.connections_total ?? 0)} />
        <MetricCard label="Users" value={String(overview?.users_total ?? 0)} />
      </div>

      <Card title="Users" subtitle="Primary action: Edit. Secondary actions are available from overflow menu.">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
          </div>
        ) : secrets.length === 0 ? (
          <EmptyState title="No MTProxy users" description="Create the first secret to activate MTProxy access." icon="vpn_key_off" />
        ) : (
          <>
            <div className="hidden w-full min-w-[760px] md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Runtime</th>
                    <th>Last seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {secrets.map((item) => {
                    const busy = busyID === item.id;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="font-semibold">{item.label || item.client_name || item.client_id}</div>
                          <div className="text-[0.8125rem] break-all text-muted-foreground">
                            Secret: {item.secret}
                          </div>
                        </td>
                        <td>
                          <StatusBadge enabled={item.is_enabled} />
                        </td>
                        <td>
                          <StatusBadge tone={item.is_runtime_active ? "success" : "neutral"}>
                            {item.is_runtime_active ? "active" : "standby"}
                          </StatusBadge>
                        </td>
                        <td>{formatDate(item.last_seen_at)}</td>
                        <td>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button variant="text" type="button" onClick={() => openEdit(item)} disabled={busy}>
                              Edit
                            </Button>
                            <OverflowMenu
                              items={[
                                {
                                  id: "copy",
                                  label: copiedKey === `tg-${item.id}` ? "Link copied" : "Copy tg://",
                                  icon: "content_copy",
                                  disabled: busy,
                                  onSelect: () => {
                                    void copyTelegramLink(item);
                                  },
                                },
                                {
                                  id: "delete",
                                  label: "Delete",
                                  icon: "delete",
                                  danger: true,
                                  disabled: busy,
                                  onSelect: () => askDelete(item),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {secrets.map((item) => {
                const busy = busyID === item.id;
                return (
                  <article key={item.id} className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-4">
                    <div>
                      <h3 className="text-sm font-semibold">{item.label || item.client_name || item.client_id}</h3>
                      <p className="text-xs break-all text-muted-foreground">
                        Secret: {item.secret}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge enabled={item.is_enabled} />
                      <StatusBadge tone={item.is_runtime_active ? "success" : "neutral"}>
                        {item.is_runtime_active ? "active" : "standby"}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last seen: {formatDate(item.last_seen_at)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="tonal" type="button" onClick={() => openEdit(item)} disabled={busy}>
                        Edit
                      </Button>
                      <OverflowMenu
                        items={[
                          {
                            id: "copy",
                            label: copiedKey === `tg-${item.id}` ? "Link copied" : "Copy tg://",
                            icon: "content_copy",
                            disabled: busy,
                            onSelect: () => {
                              void copyTelegramLink(item);
                            },
                          },
                          {
                            id: "delete",
                            label: "Delete",
                            icon: "delete",
                            danger: true,
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
      </Card>

      <Dialog
        open={formOpen}
        title={editing ? "Edit MTProxy user" : "Create MTProxy user"}
        onClose={closeForm}
        actions={
          <>
            <Button variant="text" type="button" onClick={closeForm} disabled={formBusy}>
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
            errorText={formErrors.client_id}
            onChange={(event) => {
              setFormState((prev) => ({ ...prev, client_id: event.target.value }));
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
            supportingText="Optional display name for this secret."
          />

          <TextField
            label="Secret"
            value={formState.secret}
            onChange={(event) => setFormState((prev) => ({ ...prev, secret: event.target.value }))}
            placeholder="Auto-generated if empty"
            supportingText="Leave empty to generate a secure runtime secret."
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete MTProxy user"
        description={`Delete ${deleting?.label || deleting?.client_name || "this user"}? This action cannot be undone.`}
        confirmLabel="Delete"
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeSecret}
        busy={deleteBusy}
      />
    </div>
  );
}






