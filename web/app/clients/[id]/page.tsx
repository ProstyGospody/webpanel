"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, Hy2Account, MTProxySecret } from "@/lib/types";
import { StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

type ClientPayload = {
  client: Client;
  hy2_accounts: Hy2Account[];
  mtproxy_secrets: MTProxySecret[];
};

export default function ClientDetailsPage() {
  const { push } = useToast();
  const params = useParams<{ id: string }>();
  const clientID = params.id;

  const [payload, setPayload] = useState<ClientPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    const data = await apiFetch<ClientPayload>(`/api/clients/${clientID}`);
    setPayload(data);
    setNote(data.client.note || "");
  }

  useEffect(() => {
    if (!clientID) {
      return;
    }
    load().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load client";
      setError(msg);
      push(msg, "error");
    });
  }, [clientID, push]);

  async function updateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload) {
      return;
    }
    try {
      await apiFetch(`/api/clients/${clientID}`, {
        method: "PATCH",
        body: toJSONBody({
          name: payload.client.name,
          email: payload.client.email,
          note,
        }),
      });
      await load();
      push("Saved", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update client";
      setError(msg);
      push(msg, "error");
    }
  }

  async function setClientState(enabled: boolean) {
    if (!enabled && !confirm("Disable this client? Active accesses will be revoked.")) {
      return;
    }
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch(`/api/clients/${clientID}/${endpoint}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      await load();
      push(enabled ? "Client enabled" : "Client disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update client status";
      setError(msg);
      push(msg, "error");
    }
  }

  async function createHy2() {
    try {
      await apiFetch("/api/hy2/accounts", {
        method: "POST",
        body: toJSONBody({ client_id: clientID }),
      });
      await load();
      push("Hysteria access created", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create Hysteria account";
      setError(msg);
      push(msg, "error");
    }
  }

  async function createSecret() {
    try {
      await apiFetch("/api/mtproxy/secrets", {
        method: "POST",
        body: toJSONBody({ client_id: clientID }),
      });
      await load();
      push("MTProxy secret created", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create MTProxy secret";
      setError(msg);
      push(msg, "error");
    }
  }

  async function toggleHy2(id: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this Hysteria account?")) {
      return;
    }
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch(`/api/hy2/accounts/${id}/${endpoint}`, { method: "POST", body: toJSONBody({}) });
      await load();
      push(enabled ? "Enabled" : "Disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to toggle Hysteria account";
      setError(msg);
      push(msg, "error");
    }
  }

  async function kickHy2(id: string) {
    if (!confirm("Kick active Hysteria sessions for this account?")) {
      return;
    }
    try {
      await apiFetch(`/api/hy2/accounts/${id}/kick`, { method: "POST", body: toJSONBody({}) });
      push("Sessions kicked", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to kick Hysteria sessions";
      setError(msg);
      push(msg, "error");
    }
  }

  async function toggleSecret(id: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this MTProxy secret?")) {
      return;
    }
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch(`/api/mtproxy/secrets/${id}/${endpoint}`, { method: "POST", body: toJSONBody({}) });
      await load();
      push(enabled ? "Enabled" : "Disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to toggle MTProxy secret";
      setError(msg);
      push(msg, "error");
    }
  }

  async function copyValue(value: string) {
    try {
      await copyToClipboard(value);
      push("Copied", "success");
    } catch {
      push("Failed to copy", "error");
    }
  }

  if (!payload) {
    return <div className="text-sm">Loading client card...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Client: {payload.client.name}</h1>
        <div className="space-x-2">
          {payload.client.is_active ? (
            <button className="btn btn-danger" onClick={() => setClientState(false)}>
              Disable client
            </button>
          ) : (
            <button className="btn btn-muted" onClick={() => setClientState(true)}>
              Enable client
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

      <section className="card space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <StatusBadge enabled={payload.client.is_active} />
          <span>Email: {payload.client.email || "-"}</span>
          <span>Updated: {formatDate(payload.client.updated_at)}</span>
        </div>
        <form className="space-y-2" onSubmit={updateClient}>
          <label className="block text-sm">Note</label>
          <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary" type="submit">
            Save note
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hysteria Accounts</h2>
          <button className="btn btn-primary" onClick={createHy2}>
            Add Hysteria access
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Identity</th>
              <th>Credential</th>
              <th>Status</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payload.hy2_accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No Hysteria accounts
                </td>
              </tr>
            )}
            {payload.hy2_accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.hy2_identity}</td>
                <td className="max-w-xs truncate">{account.auth_payload}</td>
                <td>
                  <StatusBadge enabled={account.is_enabled} />
                </td>
                <td>{formatDate(account.last_seen_at)}</td>
                <td className="space-x-2">
                  <button className="btn btn-muted" onClick={() => copyValue(account.auth_payload)}>
                    Copy credential
                  </button>
                  <button className="btn btn-muted" onClick={() => kickHy2(account.id)}>
                    Kick
                  </button>
                  {account.is_enabled ? (
                    <button className="btn btn-danger" onClick={() => toggleHy2(account.id, false)}>
                      Disable
                    </button>
                  ) : (
                    <button className="btn btn-muted" onClick={() => toggleHy2(account.id, true)}>
                      Enable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">MTProxy Secrets</h2>
          <button className="btn btn-primary" onClick={createSecret}>
            Add MTProxy secret
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Secret</th>
              <th>Status</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payload.mtproxy_secrets.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-500">
                  No MTProxy secrets
                </td>
              </tr>
            )}
            {payload.mtproxy_secrets.map((secret) => (
              <tr key={secret.id}>
                <td className="max-w-xs truncate">{secret.secret}</td>
                <td>
                  <StatusBadge enabled={secret.is_enabled} />
                </td>
                <td>{formatDate(secret.last_seen_at)}</td>
                <td className="space-x-2">
                  <button className="btn btn-muted" onClick={() => copyValue(secret.secret)}>
                    Copy
                  </button>
                  {secret.is_enabled ? (
                    <button className="btn btn-danger" onClick={() => toggleSecret(secret.id, false)}>
                      Disable
                    </button>
                  ) : (
                    <button className="btn btn-muted" onClick={() => toggleSecret(secret.id, true)}>
                      Enable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
