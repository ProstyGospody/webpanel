"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Client } from "@/lib/types";
import { StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

export default function ClientsPage() {
  const { push } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadClients(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    const response = await apiFetch<{ items: Client[] }>(`/api/clients${q}`);
    setClients(response.items || []);
  }

  useEffect(() => {
    loadClients().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load clients";
      setError(msg);
      push(msg, "error");
    });
  }, [push]);

  const filtered = useMemo(() => clients, [clients]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch<Client>("/api/clients", {
        method: "POST",
        body: toJSONBody({
          name,
          email: email || null,
          note: note || null,
        }),
      });
      setName("");
      setEmail("");
      setNote("");
      await loadClients(search);
      push("Created", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create client";
      setError(msg);
      push(msg, "error");
    }
  }

  async function setClientState(clientID: string, enabled: boolean) {
    if (!enabled && !confirm("Disable this client? Active accesses will be revoked.")) {
      return;
    }
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch<{ ok: boolean }>(`/api/clients/${clientID}/${endpoint}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      await loadClients(search);
      push(enabled ? "Enabled" : "Disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update client";
      setError(msg);
      push(msg, "error");
    }
  }

  async function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    await loadClients(search);
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage client records and access state across Hysteria 2 and MTProxy.</p>
        </div>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <form className="card grid gap-3 md:grid-cols-5" onSubmit={onCreate}>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted">Client name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full" type="submit">
            Create client
          </button>
        </div>
      </form>

      <form className="card flex gap-2" onSubmit={onSearchSubmit}>
        <input className="input" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-muted" type="submit">
          Search
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  No clients found
                </td>
              </tr>
            )}
            {filtered.map((client) => (
              <tr key={client.id}>
                <td>
                  <Link href={`/clients/${client.id}`} className="font-medium underline-offset-2 hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td>{client.email || "-"}</td>
                <td>
                  <StatusBadge enabled={client.is_active} />
                </td>
                <td>{formatDate(client.updated_at)}</td>
                <td className="space-x-2">
                  {client.is_active ? (
                    <button className="btn btn-danger" onClick={() => setClientState(client.id, false)}>
                      Disable
                    </button>
                  ) : (
                    <button className="btn btn-muted" onClick={() => setClientState(client.id, true)}>
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

