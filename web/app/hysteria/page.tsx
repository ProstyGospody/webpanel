"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Client, Hy2Account } from "@/lib/types";
import { Card, MetricCard, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

type Hy2Overview = {
  enabled_accounts: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

type Hy2ConfigValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    listen?: string;
    port?: number;
    auth_type?: string;
    auth_http_url?: string;
    primary_domain?: string;
    sni?: string;
    insecure?: boolean;
    pin_sha256?: string;
    obfs_type?: string;
    obfs_password?: string;
    alpn?: string[];
  };
};

type Hy2ConfigPayload = {
  path: string;
  content: string;
  validation: Hy2ConfigValidation;
};

type Hy2ClientParams = {
  server?: string;
  port?: number;
  sni?: string;
  insecure?: boolean;
  pin_sha256?: string;
  obfs_type?: string;
  obfs_password?: string;
  alpn?: string[];
};

type Hy2AccountViewPayload = {
  account: Hy2Account;
  uri: string;
  uri_v2rayng?: string;
  singbox_outbound?: Record<string, unknown>;
  client_params?: Hy2ClientParams;
};

type Hy2TrafficPoint = {
  id: number;
  hy2_account_id: string;
  tx_bytes: number;
  rx_bytes: number;
  online_count: number;
  snapshot_at: string;
};

function onlineBadgeClass(online: boolean): string {
  return `badge ${online ? "badge-online" : "badge-offline"}`;
}

export default function HysteriaPage() {
  const { push } = useToast();

  const [accounts, setAccounts] = useState<Hy2Account[]>([]);
  const [overview, setOverview] = useState<Hy2Overview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const [clientID, setClientID] = useState("");
  const [authPayload, setAuthPayload] = useState("");
  const [hy2Identity, setHy2Identity] = useState("");
  const [editingID, setEditingID] = useState<string | null>(null);

  const [tab, setTab] = useState<"users" | "config">("users");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [activeAccountAction, setActiveAccountAction] = useState<string | null>(null);

  const [uriModalOpen, setURIModalOpen] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [currentURI, setCurrentURI] = useState("");
  const [currentSingBoxJSON, setCurrentSingBoxJSON] = useState("");
  const [currentURITitle, setCurrentURITitle] = useState("");
  const [currentClientParams, setCurrentClientParams] = useState<Hy2ClientParams | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [trafficModalOpen, setTrafficModalOpen] = useState(false);
  const [trafficTitle, setTrafficTitle] = useState("");
  const [trafficRows, setTrafficRows] = useState<Hy2TrafficPoint[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);

  const [configPath, setConfigPath] = useState("");
  const [configText, setConfigText] = useState("");
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [applyingConfig, setApplyingConfig] = useState(false);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  function markCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1600);
  }

  async function loadAll(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    const [accountResp, overviewResp, clientsResp, configResp] = await Promise.all([
      apiFetch<{ items: Hy2Account[] }>("/api/hy2/accounts"),
      apiFetch<Hy2Overview>("/api/hy2/stats/overview"),
      apiFetch<{ items: Client[] }>("/api/clients?limit=500"),
      apiFetch<Hy2ConfigPayload>("/api/hy2/config"),
    ]);

    setAccounts(accountResp.items || []);
    setOverview(overviewResp);
    setClients(clientsResp.items || []);
    setConfigPath(configResp.path || "");
    setConfigText(configResp.content || "");
    setConfigValidation(configResp.validation || null);

    if (!clientID && clientsResp.items && clientsResp.items.length > 0) {
      setClientID(clientsResp.items[0].id);
    }

    if (showLoader) {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(true).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load hysteria data";
      setError(msg);
      setLoading(false);
      push(msg, "error");
    });
  }, [push]);

  async function withAccountAction(accountID: string, task: () => Promise<void>) {
    setActiveAccountAction(accountID);
    try {
      await task();
    } finally {
      setActiveAccountAction((current) => (current === accountID ? null : current));
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingUser(true);
    setError(null);

    try {
      if (editingID) {
        await apiFetch(`/api/hy2/accounts/${editingID}`, {
          method: "PATCH",
          body: toJSONBody({
            auth_payload: authPayload,
            hy2_identity: hy2Identity,
          }),
        });
        push("User updated", "success");
      } else {
        await apiFetch("/api/hy2/accounts", {
          method: "POST",
          body: toJSONBody({
            client_id: clientID,
            auth_payload: authPayload || null,
            hy2_identity: hy2Identity || null,
          }),
        });
        push("User created", "success");
      }

      clearForm();
      await loadAll(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save Hysteria account";
      setError(msg);
      push(msg, "error");
    } finally {
      setSavingUser(false);
    }
  }

  function clearForm() {
    setEditingID(null);
    setAuthPayload("");
    setHy2Identity("");
  }

  function startEdit(account: Hy2Account) {
    setEditingID(account.id);
    setClientID(account.client_id);
    setAuthPayload(account.auth_payload);
    setHy2Identity(account.hy2_identity);
  }

  async function toggle(id: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this Hysteria account?")) {
      return;
    }
    const endpoint = enabled ? "enable" : "disable";

    await withAccountAction(id, async () => {
      try {
        await apiFetch(`/api/hy2/accounts/${id}/${endpoint}`, {
          method: "POST",
          body: toJSONBody({}),
        });
        push(enabled ? "User enabled" : "User disabled", "success");
        await loadAll(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to change account status";
        setError(msg);
        push(msg, "error");
      }
    });
  }

  async function removeAccount(id: string) {
    if (!confirm("Delete this Hysteria account? This action cannot be undone.")) {
      return;
    }

    await withAccountAction(id, async () => {
      try {
        await apiFetch(`/api/hy2/accounts/${id}`, {
          method: "DELETE",
          body: toJSONBody({}),
        });
        push("User deleted", "success");
        await loadAll(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete account";
        setError(msg);
        push(msg, "error");
      }
    });
  }

  async function kick(id: string) {
    if (!confirm("Kick active session for this account?")) {
      return;
    }

    await withAccountAction(id, async () => {
      try {
        await apiFetch(`/api/hy2/accounts/${id}/kick`, {
          method: "POST",
          body: toJSONBody({}),
        });
        push("Session kicked", "success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to kick session";
        setError(msg);
        push(msg, "error");
      }
    });
  }

  async function openURI(account: Hy2Account, withQR: boolean) {
    await withAccountAction(account.id, async () => {
      try {
        const payload = await apiFetch<Hy2AccountViewPayload>(`/api/hy2/accounts/${account.id}`);
        setCurrentURI(payload.uri);
        setCurrentSingBoxJSON(JSON.stringify(payload.singbox_outbound || {}, null, 2));
        setCurrentURITitle(account.client_name || account.hy2_identity);
        setCurrentClientParams(payload.client_params || null);
        setShowQRCode(withQR);
        setURIModalOpen(true);
        push(withQR ? "QR opened" : "Connection details opened", "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load URI";
        setError(msg);
        push(msg, "error");
      }
    });
  }

  async function copyAccountURI(account: Hy2Account) {
    await withAccountAction(account.id, async () => {
      try {
        const payload = await apiFetch<Hy2AccountViewPayload>(`/api/hy2/accounts/${account.id}`);
        await copyToClipboard(payload.uri);
        markCopied(`uri-${account.id}`);
        push("URI copied", "success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to copy URI";
        setError(msg);
        push(msg, "error");
      }
    });
  }

  async function openTraffic(account: Hy2Account) {
    setTrafficModalOpen(true);
    setTrafficTitle(account.client_name || account.hy2_identity);
    setTrafficRows([]);
    setTrafficError(null);
    setTrafficLoading(true);

    try {
      const payload = await apiFetch<{ items: Hy2TrafficPoint[] }>(`/api/hy2/stats/history?account_id=${account.id}&limit=30`);
      setTrafficRows(payload.items || []);
      push("Traffic opened", "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load traffic";
      setTrafficError(msg);
      push(msg, "error");
    } finally {
      setTrafficLoading(false);
    }
  }

  async function copyURI(value: string, key: string) {
    try {
      await copyToClipboard(value);
      markCopied(key);
      push("Copied", "success");
    } catch {
      push("Failed to copy", "error");
    }
  }

  async function validateConfig() {
    try {
      const payload = await apiFetch<{ validation: Hy2ConfigValidation }>("/api/hy2/config/validate", {
        method: "POST",
        body: toJSONBody({ content: configText }),
      });
      setConfigValidation(payload.validation);
      push(payload.validation.valid ? "Validation passed" : "Validation failed", payload.validation.valid ? "success" : "error");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to validate config";
      setError(msg);
      push(msg, "error");
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const payload = await apiFetch<{ validation: Hy2ConfigValidation }>("/api/hy2/config", {
        method: "PUT",
        body: toJSONBody({ content: configText }),
      });
      setConfigValidation(payload.validation);
      push("Config saved", "success");
      await loadAll(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save config";
      setError(msg);
      push(msg, "error");
    } finally {
      setSavingConfig(false);
    }
  }

  async function applyConfig() {
    if (!confirm("Restart hysteria-server and apply current config?")) {
      return;
    }

    setApplyingConfig(true);
    try {
      await apiFetch("/api/hy2/config/apply", {
        method: "POST",
        body: toJSONBody({}),
      });
      push("Config applied", "success");
      await loadAll(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to apply config";
      setError(msg);
      push(msg, "error");
    } finally {
      setApplyingConfig(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold">Hysteria 2 Users</h1>
          <p className="text-sm text-muted">Manage users, status, QR/URI and traffic from one clean list.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enabled Users" value={String(overview?.enabled_accounts ?? 0)} />
        <MetricCard label="Online" value={String(overview?.online_count ?? 0)} />
        <MetricCard label="Total TX" value={formatBytes(overview?.total_tx_bytes ?? 0)} />
        <MetricCard label="Total RX" value={formatBytes(overview?.total_rx_bytes ?? 0)} />
      </div>

      <Card
        title="Hysteria Workspace"
        subtitle="User operations and config management"
        action={
          <div className="flex gap-2">
            <button className={tab === "users" ? "btn btn-primary" : "btn btn-muted"} type="button" onClick={() => setTab("users")}>
              Users
            </button>
            <button className={tab === "config" ? "btn btn-primary" : "btn btn-muted"} type="button" onClick={() => setTab("config")}>
              Config
            </button>
          </div>
        }
      >
        {tab === "users" && (
          <div className="space-y-4">
            <form className="grid gap-3 md:grid-cols-4" onSubmit={submitForm}>
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Client</span>
                <select className="input" value={clientID} onChange={(e) => setClientID(e.target.value)} required disabled={Boolean(editingID)}>
                  {sortedClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-muted">Auth payload</span>
                <input className="input" value={authPayload} onChange={(e) => setAuthPayload(e.target.value)} placeholder="Auto-generated if empty" />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-muted">Identity</span>
                <input className="input" value={hy2Identity} onChange={(e) => setHy2Identity(e.target.value)} placeholder="Auto-generated if empty" />
              </label>

              <div className="flex items-end gap-2">
                <button className="btn btn-primary" type="submit" disabled={savingUser}>
                  {savingUser ? "Saving..." : editingID ? "Update user" : "Add user"}
                </button>
                {editingID && (
                  <button className="btn btn-muted" type="button" onClick={clearForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>

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
                        <th>Online</th>
                        <th>Traffic</th>
                        <th>Last seen</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((item) => {
                        const online = (item.online_count || 0) > 0;
                        const busy = activeAccountAction === item.id;
                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="font-medium">{item.client_name || item.hy2_identity}</div>
                              <div className="text-xs text-muted">Identity: {item.hy2_identity}</div>
                              <div className="text-xs text-muted">ID: {item.id}</div>
                            </td>
                            <td>
                              <StatusBadge enabled={item.is_enabled} />
                            </td>
                            <td>
                              <span className={onlineBadgeClass(online)}>{online ? "Online" : "Offline"}</span>
                            </td>
                            <td>
                              <div className="text-sm">TX: {formatBytes(item.last_tx_bytes || 0)}</div>
                              <div className="text-sm">RX: {formatBytes(item.last_rx_bytes || 0)}</div>
                            </td>
                            <td>{formatDate(item.last_seen_at)}</td>
                            <td>
                              <div className="flex flex-wrap gap-2">
                                <button className="btn btn-muted" type="button" onClick={() => startEdit(item)} disabled={busy}>
                                  Edit
                                </button>
                                <button className="btn btn-muted" type="button" onClick={() => openURI(item, true)} disabled={busy}>
                                  QR
                                </button>
                                <button className="btn btn-muted" type="button" onClick={() => copyAccountURI(item)} disabled={busy}>
                                  {copiedKey === `uri-${item.id}` ? "Copied" : "Copy URI"}
                                </button>
                                <button className="btn btn-muted" type="button" onClick={() => openTraffic(item)} disabled={busy}>
                                  Traffic
                                </button>
                                <button className="btn btn-muted" type="button" onClick={() => openURI(item, false)} disabled={busy}>
                                  Details
                                </button>
                                <button className="btn btn-muted" type="button" onClick={() => kick(item.id)} disabled={busy}>
                                  Kick
                                </button>
                                {item.is_enabled ? (
                                  <button className="btn btn-danger" type="button" onClick={() => toggle(item.id, false)} disabled={busy}>
                                    Disable
                                  </button>
                                ) : (
                                  <button className="btn btn-muted" type="button" onClick={() => toggle(item.id, true)} disabled={busy}>
                                    Enable
                                  </button>
                                )}
                                <button className="btn btn-danger" type="button" onClick={() => removeAccount(item.id)} disabled={busy}>
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
                    const busy = activeAccountAction === item.id;

                    return (
                      <article key={item.id} className="list-row">
                        <div className="space-y-1">
                          <div className="font-medium">{item.client_name || item.hy2_identity}</div>
                          <div className="text-xs text-muted">Identity: {item.hy2_identity}</div>
                          <div className="text-xs text-muted">ID: {item.id}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <StatusBadge enabled={item.is_enabled} />
                          <span className={onlineBadgeClass(online)}>{online ? "Online" : "Offline"}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>TX: {formatBytes(item.last_tx_bytes || 0)}</div>
                          <div>RX: {formatBytes(item.last_rx_bytes || 0)}</div>
                        </div>
                        <div className="text-xs text-muted">Last seen: {formatDate(item.last_seen_at)}</div>

                        <div className="grid grid-cols-2 gap-2">
                          <button className="btn btn-muted" type="button" onClick={() => startEdit(item)} disabled={busy}>
                            Edit
                          </button>
                          <button className="btn btn-muted" type="button" onClick={() => openURI(item, true)} disabled={busy}>
                            QR
                          </button>
                          <button className="btn btn-muted" type="button" onClick={() => copyAccountURI(item)} disabled={busy}>
                            {copiedKey === `uri-${item.id}` ? "Copied" : "Copy URI"}
                          </button>
                          <button className="btn btn-muted" type="button" onClick={() => openTraffic(item)} disabled={busy}>
                            Traffic
                          </button>
                          {item.is_enabled ? (
                            <button className="btn btn-danger" type="button" onClick={() => toggle(item.id, false)} disabled={busy}>
                              Disable
                            </button>
                          ) : (
                            <button className="btn btn-muted" type="button" onClick={() => toggle(item.id, true)} disabled={busy}>
                              Enable
                            </button>
                          )}
                          <button className="btn btn-danger" type="button" onClick={() => removeAccount(item.id)} disabled={busy}>
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "config" && (
          <div className="space-y-3">
            <div className="text-sm text-muted">Source of truth: {configPath || "-"}</div>
            <textarea
              className="input min-h-[360px] font-mono text-xs"
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-muted" type="button" onClick={validateConfig}>
                Preview / Validate
              </button>
              <button className="btn btn-primary" type="button" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? "Saving..." : "Save"}
              </button>
              <button className="btn btn-danger" type="button" onClick={applyConfig} disabled={applyingConfig}>
                {applyingConfig ? "Applying..." : "Apply / Restart"}
              </button>
            </div>

            {configValidation && (
              <div className="list-row text-sm">
                <div className="font-medium">Validation: {configValidation.valid ? "OK" : "FAILED"}</div>

                {configValidation.errors.length > 0 && (
                  <div className="alert alert-error">
                    {configValidation.errors.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                )}

                {configValidation.warnings.length > 0 && (
                  <div className="alert alert-warn">
                    {configValidation.warnings.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                )}

                <div className="grid gap-1 text-xs text-muted md:grid-cols-2">
                  <div>listen: {configValidation.summary.listen || "-"}</div>
                  <div>port: {configValidation.summary.port || "-"}</div>
                  <div>auth: {configValidation.summary.auth_type || "-"}</div>
                  <div>sni: {configValidation.summary.sni || "-"}</div>
                  <div>domain: {configValidation.summary.primary_domain || "-"}</div>
                  <div>pinSHA256: {configValidation.summary.pin_sha256 || "-"}</div>
                  <div>obfs: {configValidation.summary.obfs_type || "-"}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {uriModalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setURIModalOpen(false)} />
          <div className="modal-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{currentURITitle}</h2>
              <button className="btn btn-muted" type="button" onClick={() => setURIModalOpen(false)}>
                Close
              </button>
            </div>

            <div>
              <div className="mb-1 text-xs text-muted">URI</div>
              <textarea className="input min-h-20 font-mono text-xs" value={currentURI} readOnly />
            </div>

            <div>
              <div className="mb-1 text-xs text-muted">sing-box outbound</div>
              <textarea className="input min-h-20 font-mono text-xs" value={currentSingBoxJSON} readOnly />
            </div>

            {currentClientParams && (
              <div className="list-row text-xs text-muted">
                <div>server: {currentClientParams.server || "-"}</div>
                <div>port: {currentClientParams.port || "-"}</div>
                <div>sni: {currentClientParams.sni || "-"}</div>
                <div>insecure: {currentClientParams.insecure ? "true" : "false"}</div>
                <div>pinSHA256: {currentClientParams.pin_sha256 || "-"}</div>
                <div>obfs: {currentClientParams.obfs_type || "-"}</div>
                <div>alpn: {(currentClientParams.alpn || []).join(", ") || "-"}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" type="button" onClick={() => copyURI(currentURI, "uri")}>
                {copiedKey === "uri" ? "Copied" : "Copy URI"}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => copyURI(currentSingBoxJSON, "singbox")}>
                {copiedKey === "singbox" ? "Copied" : "Copy sing-box"}
              </button>
              <button className="btn btn-muted" type="button" onClick={() => setShowQRCode((prev) => !prev)}>
                {showQRCode ? "Hide QR" : "Show QR"}
              </button>
            </div>

            {showQRCode && currentURI && (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(currentURI)}`}
                alt="Hysteria QR code"
                className="h-64 w-64 rounded-lg border"
              />
            )}
          </div>
        </>
      )}

      {trafficModalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setTrafficModalOpen(false)} />
          <div className="modal-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Traffic: {trafficTitle}</h2>
              <button className="btn btn-muted" type="button" onClick={() => setTrafficModalOpen(false)}>
                Close
              </button>
            </div>

            {trafficLoading && <div className="text-sm text-muted">Loading traffic...</div>}
            {trafficError && <div className="alert alert-error">{trafficError}</div>}
            {!trafficLoading && !trafficError && trafficRows.length === 0 && <div className="empty-state">No traffic snapshots.</div>}

            {!trafficLoading && trafficRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>TX</th>
                      <th>RX</th>
                      <th>Online</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.snapshot_at)}</td>
                        <td>{formatBytes(row.tx_bytes)}</td>
                        <td>{formatBytes(row.rx_bytes)}</td>
                        <td>{row.online_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

