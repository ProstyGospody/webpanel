"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, UserMinus, UserPlus, Users } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Client } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { ConfirmDialog } from "@/components/dialog";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { TextField } from "@/components/app/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CreateClientErrors = {
  name?: string;
  email?: string;
};

export default function ClientsPage() {
  const { push } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createErrors, setCreateErrors] = useState<CreateClientErrors>({});

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

    const nextErrors: CreateClientErrors = {};
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    if (!normalizedName) {
      nextErrors.name = "Client name is required.";
    }

    if (normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      return;
    }

    setCreateErrors({});

    try {
      await apiFetch<Client>("/api/clients", {
        method: "POST",
        body: toJSONBody({
          name: normalizedName,
          email: normalizedEmail || null,
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
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage shared client identities used across Hysteria 2 and MTProxy access surfaces."
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create client</CardTitle>
            <CardDescription>Clients are reusable identity records for protocol accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate} noValidate>
              <TextField
                label="Client name"
                value={name}
                error={createErrors.name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (createErrors.name) {
                    setCreateErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                error={createErrors.email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (createErrors.email) {
                    setCreateErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
              />
              <TextField
                label="Note"
                className="md:col-span-2"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">
                  <Plus className="size-4" />
                  Create client
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search</CardTitle>
            <CardDescription>Filter by client name or email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSearchSubmit} noValidate className="grid gap-4">
              <TextField
                label="Query"
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="flex justify-end">
                <Button variant="outline" type="submit">
                  <Search className="size-4" />
                  Search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client directory</CardTitle>
          <CardDescription>Total clients: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState title="No clients found" description="Create a client or refine your search query." icon={Users} />
          ) : (
            <>
              <div className="hidden md:block">
                <Table className="min-w-[820px] table-fixed">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[26%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="align-top">
                          <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                            {client.name}
                          </Link>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-all text-xs text-muted-foreground">{client.email || "-"}</TableCell>
                        <TableCell className="align-top">
                          <StatusBadge tone={client.is_active ? "success" : "danger"}>{client.is_active ? "Enabled" : "Disabled"}</StatusBadge>
                        </TableCell>
                        <TableCell className="align-top text-xs text-muted-foreground">{formatDate(client.updated_at)}</TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-end">
                            {client.is_active ? (
                              <Button variant="destructive" size="sm" onClick={() => setPendingStateChange({ client, enable: false })}>
                                <UserMinus className="size-4" />
                                Disable
                              </Button>
                            ) : (
                              <Button variant="secondary" size="sm" onClick={() => setPendingStateChange({ client, enable: true })}>
                                <UserPlus className="size-4" />
                                Enable
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {filtered.map((client) => (
                  <article key={client.id} className="space-y-2 rounded-xl border bg-muted/20 p-4">
                    <div>
                      <Link href={`/clients/${client.id}`} className="text-sm font-semibold hover:underline">
                        {client.name}
                      </Link>
                      <p className="mt-1 whitespace-normal break-all text-xs text-muted-foreground">{client.email || "-"}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge tone={client.is_active ? "success" : "danger"}>{client.is_active ? "Enabled" : "Disabled"}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{formatDate(client.updated_at)}</span>
                    </div>
                    <div className="flex justify-end">
                      {client.is_active ? (
                        <Button variant="destructive" size="sm" onClick={() => setPendingStateChange({ client, enable: false })}>
                          <UserMinus className="size-4" />
                          Disable
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setPendingStateChange({ client, enable: true })}>
                          <UserPlus className="size-4" />
                          Enable
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
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

