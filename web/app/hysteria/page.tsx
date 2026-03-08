"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Client, Hy2Account } from "@/lib/types";
import { StatusBadge } from "@/components/ui";
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
  obfs_type?: string;
  obfs_password?: string;
  alpn?: string[];
};

type Hy2AccountViewPayload = {
  account: Hy2Account;
  uri: string;
  client_params?: Hy2ClientParams;
};

export default function HysteriaPage() {
  const { push } = useToast();
  const [accounts, setAccounts] = useState<Hy2Account[]>([]);
  const [overview, setOverview] = useState<Hy2Overview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientID, setClientID] = useState("");
  const [authPayload, setAuthPayload] = useState("");
  const [hy2Identity, setHy2Identity] = useState("");
  const [editingID, setEditingID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "config">("users");

  const [uriModalOpen, setURIModalOpen] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [currentURI, setCurrentURI] = useState("");
  const [currentURITitle, setCurrentURITitle] = useState("");
  const [currentClientParams, setCurrentClientParams] = useState<Hy2ClientParams | null>(null);

  const [configPath, setConfigPath] = useState("");
  const [configText, setConfigText] = useState("");
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [applyingConfig, setApplyingConfig] = useState(false);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  async function loadAll() {
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
  }

  useEffect(() => {
    loadAll().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load hysteria data";
      setError(msg);
      push(msg, "error");
    });
  }, [push]);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingID) {
        await apiFetch(`/api/hy2/accounts/${editingID}`, {
          method: "PATCH",
          body: toJSONBody({
            auth_payload: authPayload,
            hy2_identity: hy2Identity,
          }),
        });
        push("Updated", "success");
      } else {
        await apiFetch("/api/hy2/accounts", {
          method: "POST",
          body: toJSONBody({
            client_id: clientID,
            auth_payload: authPayload || null,
            hy2_identity: hy2Identity || null,
          }),
        });
        push("Created", "success");
      }
      clearForm();
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save Hysteria account";
      setError(msg);
      push(msg, "error");
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
    try {
      await apiFetch(`/api/hy2/accounts/${id}/${endpoint}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      push(enabled ? "Enabled" : "Disabled", "success");
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to change account status";
      setError(msg);
      push(msg, "error");
    }
  }

  async function removeAccount(id: string) {
    if (!confirm("Delete this Hysteria account?")) {
      return;
    }
    try {
      await apiFetch(`/api/hy2/accounts/${id}`, {
        method: "DELETE",
        body: toJSONBody({}),
      });
      push("Deleted", "success");
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      setError(msg);
      push(msg, "error");
    }
  }

  async function kick(id: string) {
    if (!confirm("Kick active session for this account?")) {
      return;
    }
    try {
      await apiFetch(`/api/hy2/accounts/${id}/kick`, {
        method: "POST",
        body: toJSONBody({}),
      });
      push("Kicked", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to kick session";
      setError(msg);
      push(msg, "error");
    }
  }

  async function openURI(account: Hy2Account, withQR: boolean) {
    try {
      const payload = await apiFetch<Hy2AccountViewPayload>(`/api/hy2/accounts/${account.id}`);
      setCurrentURI(payload.uri);
      setCurrentURITitle(account.client_name || account.hy2_identity);
      setCurrentClientParams(payload.client_params || null);
      setShowQRCode(withQR);
      setURIModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load URI";
      setError(msg);
      push(msg, "error");
    }
  }

  async function copyURI(uri: string) {
    try {
      await copyToClipboard(uri);
      push("РЎРєРѕРїРёСЂРѕРІР°РЅРѕ", "success");
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
      push("РЎРѕС…СЂР°РЅРµРЅРѕ", "success");
      await loadAll();
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
      push("РџСЂРёРјРµРЅРµРЅРѕ", "success");
      await loadAll();
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
      <h1 className="text-2xl font-semibold">Hysteria 2</h1>
      {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <div className="text-sm text-slate-600">Enabled Accounts</div>
          <div className="text-2xl font-semibold">{overview?.enabled_accounts ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Online</div>
          <div className="text-2xl font-semibold">{overview?.online_count ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Total TX</div>
          <div className="text-xl font-semibold">{formatBytes(overview?.total_tx_bytes ?? 0)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Total RX</div>
          <div className="text-xl font-semibold">{formatBytes(overview?.total_rx_bytes ?? 0)}</div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex gap-2">
          <button className={tab === "users" ? "btn btn-primary" : "btn btn-muted"} onClick={() => setTab("users")}>Users</button>
          <button className={tab === "config" ? "btn btn-primary" : "btn btn-muted"} onClick={() => setTab("config")}>Config</button>
        </div>

        {tab === "users" && (
          <div className="space-y-4">
            <form className="grid gap-2 md:grid-cols-4" onSubmit={submitForm}>
              <div>
                <label className="mb-1 block text-sm">Client</label>
                <select className="input" value={clientID} onChange={(e) => setClientID(e.target.value)} required disabled={Boolean(editingID)}>
                  {sortedClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm">Auth payload</label>
                <input className="input" value={authPayload} onChange={(e) => setAuthPayload(e.target.value)} placeholder="auto if empty" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Identity</label>
                <input className="input" value={hy2Identity} onChange={(e) => setHy2Identity(e.target.value)} placeholder="auto if empty" />
              </div>
              <div className="flex items-end gap-2">
                <button className="btn btn-primary" type="submit">{editingID ? "Update" : "Add user"}</button>
                {editingID && (
                  <button className="btn btn-muted" type="button" onClick={clearForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Online</th>
                    <th>Traffic</th>
                    <th>Last seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-500">
                        No Hysteria accounts
                      </td>
                    </tr>
                  )}
                  {accounts.map((item) => {
                    const online = (item.online_count || 0) > 0;
                    return (
                      <tr key={item.id}>
                        <td className="max-w-xs truncate">{item.hy2_identity}</td>
                        <td>{item.client_name || item.client_id}</td>
                        <td>
                          <StatusBadge enabled={item.is_enabled} />
                        </td>
                        <td>
                          <span className={`badge ${online ? "badge-online" : "badge-offline"}`}>{online ? "online" : "offline"}</span>
                        </td>
                        <td>
                          TX: {formatBytes(item.last_tx_bytes || 0)}
                          <br />
                          RX: {formatBytes(item.last_rx_bytes || 0)}
                        </td>
                        <td>{formatDate(item.last_seen_at)}</td>
                        <td className="space-x-2">
                          <button className="btn btn-muted" onClick={() => openURI(item, false)}>URI</button>
                          <button className="btn btn-muted" onClick={() => openURI(item, true)}>QR</button>
                          <button className="btn btn-muted" onClick={() => startEdit(item)}>Edit</button>
                          <button className="btn btn-danger" onClick={() => removeAccount(item.id)}>Delete</button>
                          <button className="btn btn-muted" onClick={() => kick(item.id)}>Kick</button>
                          {item.is_enabled ? (
                            <button className="btn btn-danger" onClick={() => toggle(item.id, false)}>Disable</button>
                          ) : (
                            <button className="btn btn-muted" onClick={() => toggle(item.id, true)}>Enable</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "config" && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">Source of truth: {configPath || "-"}</div>
            <textarea
              className="input min-h-[360px] font-mono text-xs"
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-muted" onClick={validateConfig}>Preview / Validate</button>
              <button className="btn btn-primary" onClick={saveConfig} disabled={savingConfig}>{savingConfig ? "Saving..." : "Save"}</button>
              <button className="btn btn-danger" onClick={applyConfig} disabled={applyingConfig}>{applyingConfig ? "Applying..." : "Apply / Restart"}</button>
            </div>

            {configValidation && (
              <div className="rounded border border-slate-300 p-3 text-sm">
                <div className="mb-2 font-medium">Validation: {configValidation.valid ? "OK" : "FAILED"}</div>
                {configValidation.errors.length > 0 && (
                  <div className="mb-2 rounded bg-red-50 p-2 text-red-800">
                    {configValidation.errors.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                )}
                {configValidation.warnings.length > 0 && (
                  <div className="mb-2 rounded bg-amber-50 p-2 text-amber-900">
                    {configValidation.warnings.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                )}
                <div className="grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                  <div>listen: {configValidation.summary.listen || "-"}</div>
                  <div>port: {configValidation.summary.port || "-"}</div>
                  <div>auth: {configValidation.summary.auth_type || "-"}</div>
                  <div>sni: {configValidation.summary.sni || "-"}</div>
                  <div>domain: {configValidation.summary.primary_domain || "-"}</div>
                  <div>obfs: {configValidation.summary.obfs_type || "-"}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {uriModalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setURIModalOpen(false)} />
          <div className="modal-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{currentURITitle}</h2>
              <button className="btn btn-muted" onClick={() => setURIModalOpen(false)}>Close</button>
            </div>
            <textarea className="input min-h-24 font-mono text-xs" value={currentURI} readOnly />
            {currentClientParams && (
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                <div>server: {currentClientParams.server || "-"}</div>
                <div>port: {currentClientParams.port || "-"}</div>
                <div>sni: {currentClientParams.sni || "-"}</div>
                <div>insecure: {currentClientParams.insecure ? "true" : "false"}</div>
                <div>obfs: {currentClientParams.obfs_type || "-"}</div>
                <div>alpn: {(currentClientParams.alpn || []).join(", ") || "-"}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => copyURI(currentURI)}>Copy URI</button>
              <button className="btn btn-muted" onClick={() => setShowQRCode((prev) => !prev)}>{showQRCode ? "Hide QR" : "Show QR"}</button>
            </div>
            {showQRCode && currentURI && (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(currentURI)}`}
                alt="Hysteria QR code"
                className="h-64 w-64 rounded border border-slate-200"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

