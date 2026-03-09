"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Client, Hy2Account } from "@/lib/types";
import { Card, MetricCard, StatusBadge } from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { useToast } from "@/components/toast-provider";

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
  pin_sha256?: string;
  obfs_type?: string;
  obfs_password?: string;
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

const POLL_INTERVAL_MS = 10000;

function onlineBadgeClass(online: boolean): string {
  return `badge ${online ? "badge-online" : "badge-offline"}`;
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
      const message = err instanceof Error ? err.message : "Failed to load Hysteria users";
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
      auth_payload: "",
      hy2_identity: "",
    }));
    setFormOpen(true);
  }

  function openEdit(account: Hy2Account) {
    setEditing(account);
    setFormState({
      client_id: account.client_id,
      auth_payload: account.auth_payload,
      hy2_identity: account.hy2_identity,
    });
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
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

      setFormOpen(false);
      setEditing(null);
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
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hysteria 2 Users</h1>
          <p className="page-subtitle">Manage users in modal workflows and keep URI/QR in sync with runtime settings.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          Create User
        </button>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enabled" value={String(overview?.enabled_accounts ?? 0)} />
        <MetricCard label="Online" value={String(overview?.online_count ?? 0)} />
        <MetricCard label="Total TX" value={formatBytes(overview?.total_tx_bytes ?? 0)} />
        <MetricCard label="Total RX" value={formatBytes(overview?.total_rx_bytes ?? 0)} />
      </div>

      <Card title="Users" subtitle="Core actions: Edit, Delete, QR and Copy URI.">
        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">No Hysteria users yet.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Traffic</th>
                    <th>Last seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((item) => {
                    const online = (item.online_count || 0) > 0;
                    const busy = busyID === item.id;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="font-medium">{item.client_name || item.hy2_identity}</div>
                          <div className="text-xs text-muted break-all">Identity: {item.hy2_identity}</div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge enabled={item.is_enabled} />
                            <span className={onlineBadgeClass(online)}>{online ? "Online" : "Offline"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm">TX: {formatBytes(item.last_tx_bytes || 0)}</div>
                          <div className="text-sm">RX: {formatBytes(item.last_rx_bytes || 0)}</div>
                        </td>
                        <td>{formatDate(item.last_seen_at)}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn btn-ghost" type="button" onClick={() => openEdit(item)} disabled={busy}>
                              Edit
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={() => openQR(item)} disabled={busy}>
                              QR
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={() => copyURI(item)} disabled={busy}>
                              {copiedKey === `uri-${item.id}` ? "Copied" : "Copy URI"}
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
              {accounts.map((item) => {
                const online = (item.online_count || 0) > 0;
                const busy = busyID === item.id;
                return (
                  <article key={item.id} className="list-row space-y-2">
                    <div>
                      <div className="font-medium">{item.client_name || item.hy2_identity}</div>
                      <div className="text-xs text-muted break-all">Identity: {item.hy2_identity}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge enabled={item.is_enabled} />
                      <span className={onlineBadgeClass(online)}>{online ? "Online" : "Offline"}</span>
                    </div>
                    <div className="text-sm">TX: {formatBytes(item.last_tx_bytes || 0)} | RX: {formatBytes(item.last_rx_bytes || 0)}</div>
                    <div className="text-xs text-muted">Last seen: {formatDate(item.last_seen_at)}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn btn-ghost" type="button" onClick={() => openEdit(item)} disabled={busy}>
                        Edit
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => openQR(item)} disabled={busy}>
                        QR
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => copyURI(item)} disabled={busy}>
                        {copiedKey === `uri-${item.id}` ? "Copied" : "Copy URI"}
                      </button>
                      <button className="btn btn-danger" type="button" onClick={() => askDelete(item)} disabled={busy}>
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
        title={editing ? "Edit Hysteria User" : "Create Hysteria User"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setFormOpen(false)} disabled={formBusy}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" form="hy2-user-form" disabled={formBusy}>
              {formBusy ? "Saving..." : editing ? "Save" : "Create"}
            </button>
          </>
        }
      >
        <form id="hy2-user-form" className="space-y-3" onSubmit={submitForm}>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Client</span>
            <select
              className="input"
              value={formState.client_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, client_id: event.target.value }))}
              required
              disabled={Boolean(editing)}
            >
              {sortedClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Auth payload</span>
            <input
              className="input"
              value={formState.auth_payload}
              onChange={(event) => setFormState((prev) => ({ ...prev, auth_payload: event.target.value }))}
              placeholder="Auto-generated if empty"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Identity</span>
            <input
              className="input"
              value={formState.hy2_identity}
              onChange={(event) => setFormState((prev) => ({ ...prev, hy2_identity: event.target.value }))}
              placeholder="Auto-generated if empty"
            />
          </label>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete user"
        description={`Delete ${deleting?.client_name || deleting?.hy2_identity || "this user"}? This cannot be undone.`}
        confirmLabel="Delete"
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeUser}
        busy={deleteBusy}
      />

      <Dialog
        open={uriOpen}
        title={`Connection: ${uriTitle}`}
        onClose={() => setURIOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => copyValue(uriValue, "uri")}> 
              {copiedKey === "uri" ? "Copied" : "Copy URI"}
            </button>
            {uriV2Ray && (
              <button className="btn btn-ghost" type="button" onClick={() => copyValue(uriV2Ray, "uri-v2")}> 
                {copiedKey === "uri-v2" ? "Copied" : "Copy hy2://"}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs text-muted">hysteria2 URI</div>
            <textarea className="input min-h-20 font-mono text-xs break-all" value={uriValue} readOnly />
          </div>

          {uriV2Ray && (
            <div>
              <div className="mb-1 text-xs text-muted">V2RayNG hy2 URI</div>
              <textarea className="input min-h-20 font-mono text-xs break-all" value={uriV2Ray} readOnly />
            </div>
          )}

          {uriClientParams && (
            <div className="list-row text-xs text-muted break-all">
              server: {uriClientParams.server || "-"} | port: {uriClientParams.port || "-"} | sni: {uriClientParams.sni || "-"}
            </div>
          )}

          {uriValue && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(uriValue)}`}
              alt="Hysteria QR code"
              className="h-56 w-56 rounded-md"
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}

