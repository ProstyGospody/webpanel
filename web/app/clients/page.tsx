"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Client } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  InlineMessage,
  PageHeader,
  StatusBadge,
  TextField,
} from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { ConfirmDialog } from "@/components/dialog";

export default function ClientsPage() {
  const { push } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [pendingStateChange, setPendingStateChange] = useState<{ client: Client; enable: boolean } | null>(null);
  const [changingState, setChangingState] = useState(false);

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
      push("Client created", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create client";
      setError(msg);
      push(msg, "error");
    }
  }

  async function setClientState(clientID: string, enabled: boolean) {
    setChangingState(true);
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch<{ ok: boolean }>(`/api/clients/${clientID}/${endpoint}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      await loadClients(search);
      push(enabled ? "Client enabled" : "Client disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update client";
      setError(msg);
      push(msg, "error");
    } finally {
      setChangingState(false);
      setPendingStateChange(null);
    }
  }

  async function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    await loadClients(search);
  }

  return (
    <div className="md-page-stack">
      <PageHeader
        title="Clients"
        subtitle="Manage client identities and lifecycle state across Hysteria 2 and MTProxy."
      />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Create client" subtitle="Client entities are shared across protocol modules.">
        <form className="md-form-grid" onSubmit={onCreate}>
          <TextField label="Client name" value={name} onChange={(event) => setName(event.target.value)} required />
          <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="md-page-actions" style={{ alignItems: "end" }}>
            <Button type="submit">Create client</Button>
          </div>
        </form>
      </Card>

      <Card title="Search" subtitle="Filter by name or email.">
        <form onSubmit={onSearchSubmit} className="md-form-grid">
          <TextField
            label="Query"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="md-page-actions" style={{ alignItems: "end" }}>
            <Button variant="outlined" type="submit">
              Search
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Client list" subtitle={`Total clients: ${filtered.length}`}>
        {filtered.length === 0 ? (
          <EmptyState title="No clients found" description="Try creating a new client or changing search query." icon="group_off" />
        ) : (
          <div className="md-data-table-wrap">
            <table className="md-data-table">
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
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <Link href={`/clients/${client.id}`} style={{ fontWeight: 600 }}>
                        {client.name}
                      </Link>
                    </td>
                    <td>{client.email || "-"}</td>
                    <td>
                      <StatusBadge enabled={client.is_active} />
                    </td>
                    <td>{formatDate(client.updated_at)}</td>
                    <td>
                      {client.is_active ? (
                        <Button variant="danger" onClick={() => setPendingStateChange({ client, enable: false })}>
                          Disable
                        </Button>
                      ) : (
                        <Button variant="tonal" onClick={() => setPendingStateChange({ client, enable: true })}>
                          Enable
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingStateChange)}
        title={pendingStateChange?.enable ? "Enable client" : "Disable client"}
        description={
          pendingStateChange?.enable
            ? `Enable ${pendingStateChange.client.name} and restore protocol access?`
            : `Disable ${pendingStateChange?.client.name || "client"}? Active accesses will be revoked.`
        }
        confirmLabel={pendingStateChange?.enable ? "Enable" : "Disable"}
        onClose={() => setPendingStateChange(null)}
        onConfirm={() => {
          if (!pendingStateChange) {
            return;
          }
          void setClientState(pendingStateChange.client.id, pendingStateChange.enable);
        }}
        busy={changingState}
        danger={!pendingStateChange?.enable}
      />
    </div>
  );
}

