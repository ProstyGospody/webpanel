"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { Client, Hy2Account, MTProxySecret } from "@/lib/types";
import { Button, Card, EmptyState, InlineMessage, PageHeader, StatusBadge, TextareaField } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { ConfirmDialog } from "@/components/dialog";

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
      <div className="md-page-stack">
        <InlineMessage tone="info">Loading client details...</InlineMessage>
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
    <div className="md-page-stack">
      <PageHeader
        title={`Client: ${payload.client.name}`}
        subtitle={`Email: ${payload.client.email || "-"}`}
        actions={
          payload.client.is_active ? (
            <Button variant="danger" onClick={() => setPendingAction({ kind: "client", enable: false })}>
              Disable client
            </Button>
          ) : (
            <Button variant="tonal" onClick={() => setPendingAction({ kind: "client", enable: true })}>
              Enable client
            </Button>
          )
        }
      />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Profile" subtitle={`Updated: ${formatDate(payload.client.updated_at)}`}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <StatusBadge enabled={payload.client.is_active} />
        </div>

        <form onSubmit={updateClient} style={{ display: "grid", gap: 12 }}>
          <TextareaField label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="md-page-actions">
            <Button type="submit">Save note</Button>
          </div>
        </form>
      </Card>

      <Card
        title="Hysteria accounts"
        subtitle="Credential and session controls for this client."
        action={
          <Button onClick={() => void createHy2()} icon="add">
            Add access
          </Button>
        }
      >
        {payload.hy2_accounts.length === 0 ? (
          <EmptyState title="No Hysteria accounts" description="Create access to issue Hysteria credentials." icon="person_off" />
        ) : (
          <div className="md-data-table-wrap">
            <table className="md-data-table">
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
                {payload.hy2_accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.hy2_identity}</td>
                    <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.auth_payload}</td>
                    <td>
                      <StatusBadge enabled={account.is_enabled} />
                    </td>
                    <td>{formatDate(account.last_seen_at)}</td>
                    <td>
                      <div className="md-row-actions">
                        <Button variant="text" onClick={() => void copyValue(account.auth_payload)}>
                          Copy
                        </Button>
                        <Button variant="outlined" onClick={() => setPendingAction({ kind: "hy2-kick", id: account.id })}>
                          Kick
                        </Button>
                        {account.is_enabled ? (
                          <Button variant="danger" onClick={() => setPendingAction({ kind: "hy2-toggle", id: account.id, enable: false })}>
                            Disable
                          </Button>
                        ) : (
                          <Button variant="tonal" onClick={() => setPendingAction({ kind: "hy2-toggle", id: account.id, enable: true })}>
                            Enable
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="MTProxy secrets"
        subtitle="Runtime-linked MTProxy keys for this client."
        action={
          <Button onClick={() => void createSecret()} icon="add">
            Add secret
          </Button>
        }
      >
        {payload.mtproxy_secrets.length === 0 ? (
          <EmptyState title="No MTProxy secrets" description="Create a secret to allow MTProxy access." icon="vpn_key_off" />
        ) : (
          <div className="md-data-table-wrap">
            <table className="md-data-table">
              <thead>
                <tr>
                  <th>Secret</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payload.mtproxy_secrets.map((secret) => (
                  <tr key={secret.id}>
                    <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{secret.secret}</td>
                    <td>
                      <StatusBadge enabled={secret.is_enabled} />
                    </td>
                    <td>{formatDate(secret.last_seen_at)}</td>
                    <td>
                      <div className="md-row-actions">
                        <Button variant="text" onClick={() => void copyValue(secret.secret)}>
                          Copy
                        </Button>
                        {secret.is_enabled ? (
                          <Button variant="danger" onClick={() => setPendingAction({ kind: "secret-toggle", id: secret.id, enable: false })}>
                            Disable
                          </Button>
                        ) : (
                          <Button variant="tonal" onClick={() => setPendingAction({ kind: "secret-toggle", id: secret.id, enable: true })}>
                            Enable
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

