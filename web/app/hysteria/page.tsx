"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type { Hy2Account } from "@/lib/types";
import { StatusBadge } from "@/components/ui";

type Hy2Overview = {
  enabled_accounts: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

export default function HysteriaPage() {
  const [accounts, setAccounts] = useState<Hy2Account[]>([]);
  const [overview, setOverview] = useState<Hy2Overview | null>(null);
  const [clientID, setClientID] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [accountResp, overviewResp] = await Promise.all([
      apiFetch<{ items: Hy2Account[] }>("/api/hy2/accounts"),
      apiFetch<Hy2Overview>("/api/hy2/stats/overview"),
    ]);
    setAccounts(accountResp.items || []);
    setOverview(overviewResp);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load hysteria data"));
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiFetch("/api/hy2/accounts", {
        method: "POST",
        body: toJSONBody({ client_id: clientID }),
      });
      setClientID("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create hysteria account");
    }
  }

  async function toggle(id: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this Hysteria account?")) {
      return;
    }
    const endpoint = enabled ? "enable" : "disable";
    await apiFetch(`/api/hy2/accounts/${id}/${endpoint}`, {
      method: "POST",
      body: toJSONBody({}),
    });
    await load();
  }

  async function copyURI(id: string) {
    const payload = await apiFetch<{ uri: string }>(`/api/hy2/accounts/${id}/uri`);
    await copyToClipboard(payload.uri);
  }

  async function kick(id: string) {
    if (!confirm("Kick active session for this account?")) {
      return;
    }
    await apiFetch(`/api/hy2/accounts/${id}/kick`, {
      method: "POST",
      body: toJSONBody({}),
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hysteria</h1>
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

      <form className="card flex items-end gap-2" onSubmit={onCreate}>
        <div className="grow">
          <label className="mb-1 block text-sm">Client ID</label>
          <input className="input" value={clientID} onChange={(e) => setClientID(e.target.value)} placeholder="UUID of existing client" required />
        </div>
        <button className="btn btn-primary" type="submit">
          Create account
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Identity</th>
              <th>Client</th>
              <th>Status</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No Hysteria accounts
                </td>
              </tr>
            )}
            {accounts.map((item) => (
              <tr key={item.id}>
                <td>{item.hy2_identity}</td>
                <td>{item.client_name || item.client_id}</td>
                <td>
                  <StatusBadge enabled={item.is_enabled} />
                </td>
                <td>{formatDate(item.last_seen_at)}</td>
                <td className="space-x-2">
                  <button className="btn btn-muted" onClick={() => copyURI(item.id)}>
                    Copy URI
                  </button>
                  <button className="btn btn-muted" onClick={() => kick(item.id)}>
                    Kick
                  </button>
                  {item.is_enabled ? (
                    <button className="btn btn-danger" onClick={() => toggle(item.id, false)}>
                      Disable
                    </button>
                  ) : (
                    <button className="btn btn-muted" onClick={() => toggle(item.id, true)}>
                      Enable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



