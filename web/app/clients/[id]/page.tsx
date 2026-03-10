"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Copy, LogOut, Plus, Settings2, UserMinus, UserPlus, Waves } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, Hy2Account, MTProxySecret } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { ConfirmDialog } from "@/components/dialog";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { TextareaField } from "@/components/app/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ClientPayload = {
  client: Client;
  hy2_accounts: Hy2Account[];
  mtproxy_secrets: MTProxySecret[];
};

type PendingAction =
  | { kind: "client"; enable: boolean }
  | { kind: "hy2-toggle"; id: string; enable: boolean }
  | { kind: "hy2-kick"; id: string }
  | { kind: "secret-toggle"; id: string; enable: boolean }
  | null;

export default function ClientDetailsPage() {
  const { push } = useToast();
  const params = useParams<{ id: string }>();
  const clientID = params.id;

  const [payload, setPayload] = useState<ClientPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionBusy, setActionBusy] = useState(false);

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
      push("Client updated", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update client";
      setError(msg);
      push(msg, "error");
    }
  }

  async function setClientState(enabled: boolean) {
    setActionBusy(true);
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
    } finally {
      setActionBusy(false);
      setPendingAction(null);
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
    setActionBusy(true);
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch(`/api/hy2/accounts/${id}/${endpoint}`, { method: "POST", body: toJSONBody({}) });
      await load();
      push(enabled ? "Hysteria account enabled" : "Hysteria account disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to toggle Hysteria account";
      setError(msg);
      push(msg, "error");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  }

  async function kickHy2(id: string) {
    setActionBusy(true);
    try {
      await apiFetch(`/api/hy2/accounts/${id}/kick`, { method: "POST", body: toJSONBody({}) });
      push("Sessions kicked", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to kick Hysteria sessions";
      setError(msg);
      push(msg, "error");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  }

  async function toggleSecret(id: string, enabled: boolean) {
    setActionBusy(true);
    try {
      const endpoint = enabled ? "enable" : "disable";
      await apiFetch(`/api/mtproxy/secrets/${id}/${endpoint}`, { method: "POST", body: toJSONBody({}) });
      await load();
      push(enabled ? "MTProxy secret enabled" : "MTProxy secret disabled", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to toggle MTProxy secret";
      setError(msg);
      push(msg, "error");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
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
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTitle>Loading</AlertTitle>
          <AlertDescription>Loading client details...</AlertDescription>
        </Alert>
      </div>
    );
  }

  const dialogTitle =
    pendingAction?.kind === "client"
      ? pendingAction.enable
        ? "Enable client"
        : "Disable client"
      : pendingAction?.kind === "hy2-toggle"
        ? pendingAction.enable
          ? "Enable Hysteria account"
          : "Disable Hysteria account"
        : pendingAction?.kind === "hy2-kick"
          ? "Kick Hysteria sessions"
          : pendingAction?.kind === "secret-toggle"
            ? pendingAction.enable
              ? "Enable MTProxy secret"
              : "Disable MTProxy secret"
            : "Confirm action";

  const dialogDescription =
    pendingAction?.kind === "client"
      ? pendingAction.enable
        ? "Enable this client and restore access across protocol services?"
        : "Disable this client? Active accesses will be revoked."
      : pendingAction?.kind === "hy2-toggle"
        ? pendingAction.enable
          ? "Enable this Hysteria account?"
          : "Disable this Hysteria account?"
        : pendingAction?.kind === "hy2-kick"
          ? "Kick active Hysteria sessions for this account?"
          : pendingAction?.kind === "secret-toggle"
            ? pendingAction.enable
              ? "Enable this MTProxy secret?"
              : "Disable this MTProxy secret?"
            : "";

  const dialogConfirm =
    pendingAction?.kind === "client"
      ? pendingAction.enable
        ? "Enable"
        : "Disable"
      : pendingAction?.kind === "hy2-toggle"
        ? pendingAction.enable
          ? "Enable"
          : "Disable"
        : pendingAction?.kind === "hy2-kick"
          ? "Kick"
          : pendingAction?.kind === "secret-toggle"
            ? pendingAction.enable
              ? "Enable"
              : "Disable"
            : "Confirm";

  const danger =
    pendingAction?.kind === "hy2-kick" ||
    (pendingAction?.kind === "client" && !pendingAction.enable) ||
    (pendingAction?.kind === "hy2-toggle" && !pendingAction.enable) ||
    (pendingAction?.kind === "secret-toggle" && !pendingAction.enable);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Client: ${payload.client.name}`}
        description={`Email: ${payload.client.email || "-"}`}
        actions={
          payload.client.is_active ? (
            <Button variant="destructive" onClick={() => setPendingAction({ kind: "client", enable: false })}>
              <UserMinus className="size-4" />
              Disable client
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setPendingAction({ kind: "client", enable: true })}>
              <UserPlus className="size-4" />
              Enable client
            </Button>
          )
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Updated: {formatDate(payload.client.updated_at)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={payload.client.is_active ? "success" : "danger"}>{payload.client.is_active ? "Enabled" : "Disabled"}</StatusBadge>
          </div>

          <form onSubmit={updateClient} noValidate className="space-y-4">
            <TextareaField label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="flex justify-end">
              <Button type="submit">
                <Settings2 className="size-4" />
                Save note
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Hysteria accounts</CardTitle>
            <CardDescription>Credential and session controls for this client.</CardDescription>
          </div>
          <Button onClick={() => void createHy2()}>
            <Plus className="size-4" />
            Add access
          </Button>
        </CardHeader>
        <CardContent>
          {payload.hy2_accounts.length === 0 ? (
            <EmptyState title="No Hysteria accounts" description="Create access to issue Hysteria credentials." icon={Waves} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identity</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.hy2_accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.hy2_identity}</TableCell>
                    <TableCell className="max-w-[260px] truncate font-mono text-xs">{account.auth_payload}</TableCell>
                    <TableCell>
                      <StatusBadge tone={account.is_enabled ? "success" : "danger"}>{account.is_enabled ? "Enabled" : "Disabled"}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(account.last_seen_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => void copyValue(account.auth_payload)}>
                          <Copy className="size-4" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPendingAction({ kind: "hy2-kick", id: account.id })}>
                          <LogOut className="size-4" />
                          Kick
                        </Button>
                        {account.is_enabled ? (
                          <Button variant="destructive" size="sm" onClick={() => setPendingAction({ kind: "hy2-toggle", id: account.id, enable: false })}>
                            Disable
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => setPendingAction({ kind: "hy2-toggle", id: account.id, enable: true })}>
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

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>MTProxy secrets</CardTitle>
            <CardDescription>Runtime-linked MTProxy keys for this client.</CardDescription>
          </div>
          <Button onClick={() => void createSecret()}>
            <Plus className="size-4" />
            Add secret
          </Button>
        </CardHeader>
        <CardContent>
          {payload.mtproxy_secrets.length === 0 ? (
            <EmptyState title="No MTProxy secrets" description="Create a secret to allow MTProxy access." icon={Settings2} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Secret</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.mtproxy_secrets.map((secret) => (
                  <TableRow key={secret.id}>
                    <TableCell className="max-w-[260px] truncate font-mono text-xs">{secret.secret}</TableCell>
                    <TableCell>
                      <StatusBadge tone={secret.is_enabled ? "success" : "danger"}>{secret.is_enabled ? "Enabled" : "Disabled"}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(secret.last_seen_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => void copyValue(secret.secret)}>
                          <Copy className="size-4" />
                          Copy
                        </Button>
                        {secret.is_enabled ? (
                          <Button variant="destructive" size="sm" onClick={() => setPendingAction({ kind: "secret-toggle", id: secret.id, enable: false })}>
                            Disable
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => setPendingAction({ kind: "secret-toggle", id: secret.id, enable: true })}>
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
        open={Boolean(pendingAction)}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={dialogConfirm}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) {
            return;
          }
          if (pendingAction.kind === "client") {
            void setClientState(pendingAction.enable);
          }
          if (pendingAction.kind === "hy2-toggle") {
            void toggleHy2(pendingAction.id, pendingAction.enable);
          }
          if (pendingAction.kind === "hy2-kick") {
            void kickHy2(pendingAction.id);
          }
          if (pendingAction.kind === "secret-toggle") {
            void toggleSecret(pendingAction.id, pendingAction.enable);
          }
        }}
        busy={actionBusy}
        danger={danger}
      />
    </div>
  );
}

