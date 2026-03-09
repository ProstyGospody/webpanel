"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Client, Hy2Account } from "@/lib/types";
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
  TextareaField,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { useToast } from "@/components/toast-provider";
import { OverflowMenu } from "@/components/overflow-menu";
import { SectionTabs } from "@/components/section-tabs";

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

function onlineBadgeClass(online: boolean): "success" | "neutral" {
  return online ? "success" : "neutral";
}

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: "group" },
  { href: "/hysteria/settings", label: "Settings", icon: "settings" },
];

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
    <div className="md-page-stack">
      <PageHeader
        title="Hysteria 2"
        subtitle="Manage users in dialog workflows and keep URI, QR and runtime settings in sync."
        actions={
          <Button onClick={openCreate} icon="add">
            Create user
          </Button>
        }
      />

      <SectionTabs items={tabs} />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <div className="md-metric-grid">
        <MetricCard label="Enabled" value={String(overview?.enabled_accounts ?? 0)} />
        <MetricCard label="Online" value={String(overview?.online_count ?? 0)} />
        <MetricCard label="Total TX" value={formatBytes(overview?.total_tx_bytes ?? 0)} />
        <MetricCard label="Total RX" value={formatBytes(overview?.total_rx_bytes ?? 0)} />
      </div>

      <Card title="Users" subtitle="Primary action: Edit. Secondary actions are grouped in an overflow menu.">
        {loading ? (
          <div className="md-skeleton">
            <div className="md-skeleton__line" />
            <div className="md-skeleton__line" />
            <div className="md-skeleton__line" />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState title="No Hysteria users" description="Create the first user to issue access credentials." icon="person_off" />
        ) : (
          <>
            <div className="hidden md-data-table-wrap md:block">
              <table className="md-data-table">
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
                          <div style={{ fontWeight: 600 }}>{item.client_name || item.hy2_identity}</div>
                          <div className="text-muted" style={{ fontSize: "0.8125rem", wordBreak: "break-all" }}>
                            Identity: {item.hy2_identity}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <StatusBadge enabled={item.is_enabled} />
                            <StatusBadge tone={onlineBadgeClass(online)}>{online ? "Online" : "Offline"}</StatusBadge>
                          </div>
                        </td>
                        <td>
                          <div>TX: {formatBytes(item.last_tx_bytes || 0)}</div>
                          <div>RX: {formatBytes(item.last_rx_bytes || 0)}</div>
                        </td>
                        <td>{formatDate(item.last_seen_at)}</td>
                        <td>
                          <div className="md-row-actions">
                            <Button variant="text" type="button" onClick={() => openEdit(item)} disabled={busy}>
                              Edit
                            </Button>
                            <OverflowMenu
                              items={[
                                {
                                  id: "qr",
                                  label: "Show QR",
                                  icon: "qr_code_2",
                                  disabled: busy,
                                  onSelect: () => {
                                    void openQR(item);
                                  },
                                },
                                {
                                  id: "copy",
                                  label: copiedKey === `uri-${item.id}` ? "URI copied" : "Copy URI",
                                  icon: "content_copy",
                                  disabled: busy,
                                  onSelect: () => {
                                    void copyURI(item);
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

            <div className="md-list md:hidden">
              {accounts.map((item) => {
                const online = (item.online_count || 0) > 0;
                const busy = busyID === item.id;
                return (
                  <article key={item.id} className="md-list-item">
                    <div>
                      <h3 className="md-list-item__headline">{item.client_name || item.hy2_identity}</h3>
                      <p className="md-list-item__supporting" style={{ wordBreak: "break-all" }}>
                        Identity: {item.hy2_identity}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge enabled={item.is_enabled} />
                      <StatusBadge tone={onlineBadgeClass(online)}>{online ? "Online" : "Offline"}</StatusBadge>
                    </div>
                    <p className="md-list-item__supporting" style={{ margin: 0 }}>
                      TX: {formatBytes(item.last_tx_bytes || 0)} | RX: {formatBytes(item.last_rx_bytes || 0)}
                    </p>
                    <p className="md-list-item__supporting" style={{ margin: 0 }}>
                      Last seen: {formatDate(item.last_seen_at)}
                    </p>
                    <div className="md-page-actions">
                      <Button variant="tonal" type="button" onClick={() => openEdit(item)} disabled={busy}>
                        Edit
                      </Button>
                      <OverflowMenu
                        items={[
                          {
                            id: "qr",
                            label: "Show QR",
                            icon: "qr_code_2",
                            disabled: busy,
                            onSelect: () => {
                              void openQR(item);
                            },
                          },
                          {
                            id: "copy",
                            label: copiedKey === `uri-${item.id}` ? "URI copied" : "Copy URI",
                            icon: "content_copy",
                            disabled: busy,
                            onSelect: () => {
                              void copyURI(item);
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
        title={editing ? "Edit Hysteria user" : "Create Hysteria user"}
        onClose={() => setFormOpen(false)}
        actions={
          <>
            <Button variant="text" type="button" onClick={() => setFormOpen(false)} disabled={formBusy}>
              Cancel
            </Button>
            <Button type="submit" form="hy2-user-form" disabled={formBusy}>
              {formBusy ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <form id="hy2-user-form" className="md-form-grid" onSubmit={submitForm}>
          <SelectField
            label="Client"
            value={formState.client_id}
            onChange={(event) => setFormState((prev) => ({ ...prev, client_id: event.target.value }))}
            required
            disabled={Boolean(editing)}
            options={sortedClients.map((client) => ({ value: client.id, label: client.name }))}
          />

          <TextField
            label="Auth payload"
            value={formState.auth_payload}
            onChange={(event) => setFormState((prev) => ({ ...prev, auth_payload: event.target.value }))}
            placeholder="Auto-generated if empty"
            supportingText="Optional custom auth payload."
          />

          <TextField
            label="Identity"
            value={formState.hy2_identity}
            onChange={(event) => setFormState((prev) => ({ ...prev, hy2_identity: event.target.value }))}
            placeholder="Auto-generated if empty"
            supportingText="Client identity visible in runtime logs."
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
            <Button variant="text" type="button" onClick={() => void copyValue(uriValue, "uri")}> 
              {copiedKey === "uri" ? "Copied" : "Copy URI"}
            </Button>
            {uriV2Ray && (
              <Button variant="text" type="button" onClick={() => void copyValue(uriV2Ray, "uri-v2")}> 
                {copiedKey === "uri-v2" ? "Copied" : "Copy hy2://"}
              </Button>
            )}
          </>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <TextareaField label="hysteria2 URI" value={uriValue} readOnly className="md-mono" />

          {uriV2Ray && <TextareaField label="V2RayNG hy2 URI" value={uriV2Ray} readOnly className="md-mono" />}

          {uriClientParams && (
            <div className="md-inline-message md-inline-message--info" style={{ marginTop: 4 }}>
              <div>
                server: {uriClientParams.server || "-"} | port: {uriClientParams.port || "-"} | sni: {uriClientParams.sni || "-"}
              </div>
            </div>
          )}

          {uriValue && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(uriValue)}`}
              alt="Hysteria QR code"
              style={{ width: 224, height: 224, borderRadius: 12, objectFit: "contain" }}
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}

