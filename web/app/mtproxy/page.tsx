"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, MTProxySecret } from "@/lib/types";
import { StatusBadge } from "@/components/ui";
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

export default function MTProxyPage() {
  const { push } = useToast();
  const [secrets, setSecrets] = useState<MTProxySecret[]>([]);
  const [overview, setOverview] = useState<MTOverview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientID, setClientID] = useState("");
  const [label, setLabel] = useState("");
  const [secretText, setSecretText] = useState("");
  const [editingID, setEditingID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLink, setCurrentLink] = useState("");

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  async function load() {
    const [secretResp, overviewResp, clientsResp] = await Promise.all([
      apiFetch<MTListPayload>("/api/mtproxy/secrets"),
      apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
      apiFetch<{ items: Client[] }>("/api/clients?limit=500"),
    ]);
    setSecrets(secretResp.items || []);
    setOverview(overviewResp);
    setClients(clientsResp.items || []);
    if (!clientID && clientsResp.items && clientsResp.items.length > 0) {
      setClientID(clientsResp.items[0].id);
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load MTProxy data";
      setError(msg);
      push(msg, "error");
    });
  }, [push]);

  function resetForm() {
    setEditingID(null);
    setLabel("");
    setSecretText("");
  }

  function startEdit(item: MTProxySecret) {
    setEditingID(item.id);
    setClientID(item.client_id);
    setLabel(item.label || "");
    setSecretText(item.secret || "");
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingID) {
        await apiFetch(`/api/mtproxy/secrets/${editingID}`, {
          method: "PATCH",
          body: toJSONBody({
            label: label || null,
            secret: secretText || null,
          }),
        });
        push("Updated", "success");
      } else {
        await apiFetch("/api/mtproxy/secrets", {
          method: "POST",
          body: toJSONBody({
            client_id: clientID,
            label: label || null,
            secret: secretText || null,
          }),
        });
        push("Created", "success");
      }
      resetForm();
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save secret";
      setError(msg);
      push(msg, "error");
    }
  }

  async function toggle(id: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this MTProxy secret?")) {
      return;
    }
    const endpoint = enabled ? "enable" : "disable";
    try {
      await apiFetch(`/api/mtproxy/secrets/${id}/${endpoint}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      push(enabled ? "Enabled" : "Disabled", "success");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setError(msg);
      push(msg, "error");
    }
  }

  async function removeSecret(id: string) {
    if (!confirm("Delete this MTProxy secret?")) {
      return;
    }
    try {
      await apiFetch(`/api/mtproxy/secrets/${id}`, {
        method: "DELETE",
        body: toJSONBody({}),
      });
      push("Deleted", "success");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete secret";
      setError(msg);
      push(msg, "error");
    }
  }

  async function copySecret(value: string) {
    try {
      await copyToClipboard(value);
      push("Скопировано", "success");
    } catch {
      push("Failed to copy", "error");
    }
  }

  async function loadLink(id: string, copy = false) {
    try {
      const payload = await apiFetch<MTSecretPayload>(`/api/mtproxy/secrets/${id}`);
      setCurrentLink(payload.tg_link);
      if (copy) {
        await copyToClipboard(payload.tg_link);
        push("Скопировано", "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load Telegram link";
      setError(msg);
      push(msg, "error");
    }
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

      <form className="card grid gap-2 md:grid-cols-4" onSubmit={submitForm}>
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
          <label className="mb-1 block text-sm">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm">Secret</label>
          <input className="input" value={secretText} onChange={(e) => setSecretText(e.target.value)} placeholder="auto if empty" />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" type="submit">{editingID ? "Update" : "Add secret"}</button>
          {editingID && (
            <button className="btn btn-muted" type="button" onClick={resetForm}>Cancel</button>
          )}
        </div>
      </form>

      {currentLink && (
        <div className="card space-y-2">
          <div className="text-sm font-medium">tg://proxy link</div>
          <textarea className="input min-h-16 font-mono text-xs" readOnly value={currentLink} />
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => copySecret(currentLink)}>Copy link</button>
            <button className="btn btn-muted" onClick={() => setCurrentLink("")}>Hide</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Secret</th>
              <th>Client</th>
              <th>Status</th>
              <th>Runtime</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {secrets.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
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
                <td>
                  <span className={`badge ${item.is_runtime_active ? "badge-online" : "badge-offline"}`}>
                    {item.is_runtime_active ? "active" : "standby"}
                  </span>
                </td>
                <td>{formatDate(item.last_seen_at)}</td>
                <td className="space-x-2">
                  <button className="btn btn-muted" onClick={() => copySecret(item.secret)}>Copy secret</button>
                  <button className="btn btn-muted" onClick={() => loadLink(item.id, true)}>Copy tg://</button>
                  <button className="btn btn-muted" onClick={() => loadLink(item.id)}>Show tg://</button>
                  <button className="btn btn-muted" onClick={() => startEdit(item)}>Edit</button>
                  <button className="btn btn-danger" onClick={() => removeSecret(item.id)}>Delete</button>
                  {item.is_enabled ? (
                    <button className="btn btn-danger" onClick={() => toggle(item.id, false)}>Disable</button>
                  ) : (
                    <button className="btn btn-muted" onClick={() => toggle(item.id, true)}>Enable</button>
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
