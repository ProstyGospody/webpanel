"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Plus, Search, UserMinus, UserPlus, Users, X } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAction, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
          note: note.trim() || null,
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

  async function onClearSearch() {
    setSearch("");
    await loadClients();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" icon={<Users />} description="Shared identities for Hysteria 2 and MTProxy." />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Create client</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
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
              placeholder="Acme Team"
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
              placeholder="ops@example.com"
            />
            <TextField
              label="Note"
              className="md:col-span-2"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
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
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Client directory</CardTitle>
            <form onSubmit={onSearchSubmit} noValidate className="flex w-full max-w-md items-center gap-2">
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Filter by name or email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search clients"
                />
                {search ? (
                  <InputGroupAction aria-label="Clear search" onClick={() => void onClearSearch()}>
                    <X className="size-3.5" />
                  </InputGroupAction>
                ) : null}
              </InputGroup>
              <Button variant="outline" type="submit" className="shrink-0">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {clients.length === 0 ? (
            <EmptyState title="No clients found" description="Create a client or change your search filter." icon={Users} />
          ) : (
            <Table>
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
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{client.email || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge tone={client.is_active ? "success" : "danger"}>
                        {client.is_active ? "Enabled" : "Disabled"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(client.updated_at)}</TableCell>
                    <TableCell>
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
