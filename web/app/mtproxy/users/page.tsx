"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, MTProxySecret } from "@/lib/types";
import { Card, MetricCard, StatusBadge } from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { useToast } from "@/components/toast-provider";

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

const POLL_INTERVAL_MS = 10000;

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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleting, setDeleting] = useState<MTProxySecret | null>(null);

  const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);

  function markCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
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
      const message = err instanceof Error ? err.message : "Failed to load MTProxy users";
      setError(message);
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
    setFormState((prev) => ({
      client_id: prev.client_id || sortedClients[0]?.id || "",
      label: "",
      secret: "",
    }));
    setFormOpen(true);
  }

  function openEdit(secret: MTProxySecret) {
    setEditing(secret);
    setFormState({
      client_id: secret.client_id,
      label: secret.label || "",
      secret: secret.secret,
    });
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
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

      setFormOpen(false);
      setEditing(null);
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
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">MTProxy Users</h1>
          <p className="page-subtitle">Manage MTProxy secrets per proxy context with compact modal workflows.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          Create User
        </button>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Enabled" value={String(overview?.enabled_secrets ?? 0)} />
        <MetricCard label="Connections" value={String(overview?.connections_total ?? 0)} />
        <MetricCard label="Users" value={String(overview?.users_total ?? 0)} />
      </div>

      <Card title="Users" subtitle="Core actions: Edit, Delete and Copy tg:// link.">
        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ) : secrets.length === 0 ? (
          <div className="empty-state">No MTProxy users yet.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
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
                          <div className="font-medium">{item.label || item.client_name || item.client_id}</div>
                          <div className="text-xs text-muted">Secret: {item.secret}</div>
                        </td>
                        <td>
                          <StatusBadge enabled={item.is_enabled} />
                        </td>
                        <td>
                          <span className={`badge ${item.is_runtime_active ? "badge-online" : "badge-neutral"}`}>
                            {item.is_runtime_active ? "active" : "standby"}
                          </span>
                        </td>
                        <td>{formatDate(item.last_seen_at)}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn btn-ghost" type="button" onClick={() => copyTelegramLink(item)} disabled={busy}>
                              {copiedKey === `tg-${item.id}` ? "Copied" : "Copy tg://"}
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={() => openEdit(item)} disabled={busy}>
                              Edit
                            </button>
                            <button className="btn btn-danger" type="button" onClick={() => askDelete(item)} disabled={busy}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {secrets.map((item) => {
                const busy = busyID === item.id;
                return (
                  <article key={item.id} className="list-row space-y-2">
                    <div className="font-medium">{item.label || item.client_name || item.client_id}</div>
                    <div className="text-xs text-muted">Secret: {item.secret}</div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge enabled={item.is_enabled} />
                      <span className={`badge ${item.is_runtime_active ? "badge-online" : "badge-neutral"}`}>
                        {item.is_runtime_active ? "active" : "standby"}
                      </span>
                    </div>
                    <div className="text-xs text-muted">Last seen: {formatDate(item.last_seen_at)}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn btn-ghost" type="button" onClick={() => copyTelegramLink(item)} disabled={busy}>
                        {copiedKey === `tg-${item.id}` ? "Copied" : "Copy tg://"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => openEdit(item)} disabled={busy}>
                        Edit
                      </button>
                      <button className="btn btn-danger col-span-2" type="button" onClick={() => askDelete(item)} disabled={busy}>
                        Delete
                      </button>
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
        title={editing ? "Edit MTProxy User" : "Create MTProxy User"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setFormOpen(false)} disabled={formBusy}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" form="mtproxy-user-form" disabled={formBusy}>
              {formBusy ? "Saving..." : editing ? "Save" : "Create"}
            </button>
          </>
        }
      >
        <form id="mtproxy-user-form" className="space-y-3" onSubmit={submitForm}>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Client</span>
            <select
              className="input"
              value={formState.client_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, client_id: event.target.value }))}
              disabled={Boolean(editing)}
              required
            >
              {sortedClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Label</span>
            <input className="input" value={formState.label} onChange={(event) => setFormState((prev) => ({ ...prev, label: event.target.value }))} />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Secret</span>
            <input
              className="input"
              value={formState.secret}
              onChange={(event) => setFormState((prev) => ({ ...prev, secret: event.target.value }))}
              placeholder="Auto-generated if empty"
            />
          </label>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete MTProxy user"
        description={`Delete ${deleting?.label || deleting?.client_name || "this user"}? This cannot be undone.`}
        confirmLabel="Delete"
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeSecret}
        busy={deleteBusy}
      />
    </div>
  );
}
