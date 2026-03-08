"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { MTProxySecret } from "@/lib/types";
import { StatusBadge } from "@/components/ui";

type MTOverview = {
  enabled_secrets: number;
  connections_total?: number | null;
  users_total?: number | null;
};

export default function MTProxyPage() {
  const [secrets, setSecrets] = useState<MTProxySecret[]>([]);
  const [overview, setOverview] = useState<MTOverview | null>(null);
  const [clientID, setClientID] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [secretResp, overviewResp] = await Promise.all([
      apiFetch<{ items: MTProxySecret[] }>("/api/mtproxy/secrets"),
      apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
    ]);
    setSecrets(secretResp.items || []);
    setOverview(overviewResp);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load MTProxy data"));
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiFetch("/api/mtproxy/secrets", {
        method: "POST",
        body: toJSONBody({
          client_id: clientID,
          label: label || null,
        }),
      });
      setClientID("");
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create secret");
    }
  }

  async function toggle(id: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this MTProxy secret?")) {
      return;
    }
    const endpoint = enabled ? "enable" : "disable";
    await apiFetch(`/api/mtproxy/secrets/${id}/${endpoint}`, {
      method: "POST",
      body: toJSONBody({}),
    });
    await load();
  }

  async function copyLink(id: string) {
    const payload = await apiFetch<{ secret: MTProxySecret; tg_link: string }>(`/api/mtproxy/secrets/${id}`);
    await copyToClipboard(payload.tg_link);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">MTProxy</h1>
      {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-sm text-slate-600">Enabled Secrets</div>
          <div className="text-2xl font-semibold">{overview?.enabled_secrets ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Connections</div>
          <div className="text-2xl font-semibold">{overview?.connections_total ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Users</div>
          <div className="text-2xl font-semibold">{overview?.users_total ?? 0}</div>
        </div>
      </div>

      <form className="card grid gap-2 md:grid-cols-3" onSubmit={onCreate}>
        <div>
          <label className="mb-1 block text-sm">Client ID</label>
          <input className="input" value={clientID} onChange={(e) => setClientID(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full" type="submit">
            Create secret
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Secret</th>
              <th>Client</th>
              <th>Status</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {secrets.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No MTProxy secrets
                </td>
              </tr>
            )}
            {secrets.map((item) => (
              <tr key={item.id}>
                <td className="max-w-xs truncate">{item.secret}</td>
                <td>{item.client_name || item.client_id}</td>
                <td>
                  <StatusBadge enabled={item.is_enabled} />
                </td>
                <td>{formatDate(item.last_seen_at)}</td>
                <td className="space-x-2">
                  <button className="btn btn-muted" onClick={() => copyToClipboard(item.secret)}>
                    Copy secret
                  </button>
                  <button className="btn btn-muted" onClick={() => copyLink(item.id)}>
                    Copy tg://
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



