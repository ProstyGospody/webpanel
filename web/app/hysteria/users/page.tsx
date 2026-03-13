"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Download, MoreHorizontal, Pencil, Plus, Power, QrCode, Search, ShieldOff, UserRound, UserRoundX, Users, X, Zap } from "lucide-react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatBytes, formatDate } from "@/lib/format";
import type {
  HysteriaOverview,
  HysteriaUser,
  HysteriaUserArtifacts,
  HysteriaUserArtifactsPayload,
  ValidationError,
} from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { TextField, TextareaField } from "@/components/app/fields";
import { Dialog, ConfirmDialog } from "@/components/dialog";
import { OverflowMenu } from "@/components/overflow-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAction, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UserFormState = {
  username: string;
  password: string;
  note: string;
};

type UserFormErrors = {
  username?: string;
  password?: string;
};

type PreviewState = {
  user: HysteriaUser;
  artifacts: HysteriaUserArtifacts;
};

const POLL_INTERVAL_MS = 10000;
const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Zap },
];

const EMPTY_FORM: UserFormState = {
  username: "",
  password: "",
  note: "",
};

export default function HysteriaUsersPage() {
  const { push } = useToast();

  const [users, setUsers] = useState<HysteriaUser[]>([]);
  const [overview, setOverview] = useState<HysteriaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [editing, setEditing] = useState<HysteriaUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<HysteriaUser | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) => {
      return user.username.toLowerCase().includes(query) || (user.note || "").toLowerCase().includes(query);
    });
  }, [search, users]);

  useEffect(() => {
    let cancelled = false;

    void load(true);

    const timer = window.setInterval(() => {
      if (!cancelled) {
        void load(false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function load(showLoader: boolean) {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const [usersPayload, overviewPayload] = await Promise.all([
        apiFetch<{ items: HysteriaUser[] }>("/api/hysteria/users?limit=500"),
        apiFetch<HysteriaOverview>("/api/hysteria/stats/overview"),
      ]);
      setUsers(usersPayload.items || []);
      setOverview(overviewPayload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Hysteria users";
      setError(message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  function openCreate() {
    setEditing(null);
    setFormErrors({});
    setFormState(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(user: HysteriaUser) {
    setEditing(user);
    setFormErrors({});
    setFormState({
      username: user.username,
      password: "",
      note: user.note || "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormErrors({});
    setFormState(EMPTY_FORM);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormBusy(true);
    setFormErrors({});
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          username: formState.username,
          note: formState.note,
        };
        if (formState.password.trim()) {
          payload.password = formState.password;
        }
        await apiFetch<HysteriaUserArtifactsPayload>(`/api/hysteria/users/${editing.id}`, {
          method: "PATCH",
          body: toJSONBody(payload),
        });
        push("Hysteria user updated", "success");
      } else {
        const payload: Record<string, unknown> = {
          username: formState.username,
          note: formState.note,
        };
        if (formState.password.trim()) {
          payload.password = formState.password;
        }
        const created = await apiFetch<HysteriaUserArtifactsPayload>("/api/hysteria/users", {
          method: "POST",
          body: toJSONBody(payload),
        });
        if (!created.artifacts) {
          throw new Error(created.access_message || "Hysteria access artifacts are unavailable for this user");
        }
        setPreview({ user: created.user, artifacts: created.artifacts });
        push("Hysteria user created", "success");
      }
      closeForm();
      await load(false);
    } catch (err) {
      if (err instanceof APIError) {
        setFormErrors(extractUserFormErrors(err.details));
      }
      const message = err instanceof Error ? err.message : "Failed to save Hysteria user";
      setError(message);
      push(message, "error");
    } finally {
      setFormBusy(false);
    }
  }

  async function openPreview(user: HysteriaUser) {
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      const payload = await apiFetch<HysteriaUserArtifactsPayload>(`/api/hysteria/users/${user.id}/artifacts`);
      if (!payload.artifacts) {
        throw new Error(payload.access_message || "Hysteria access artifacts are unavailable for this user");
      }
      setPreview({ user: payload.user, artifacts: payload.artifacts });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Hysteria access";
      setPreviewError(message);
      push(message, "error");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function copyURI(user: HysteriaUser) {
    setWorkingId(user.id);
    try {
      const payload = await apiFetch<HysteriaUserArtifactsPayload>(`/api/hysteria/users/${user.id}/artifacts`);
      if (!payload.artifacts) {
        throw new Error(payload.access_message || "Hysteria access artifacts are unavailable for this user");
      }
      await copyToClipboard(payload.artifacts.uri);
      push("Connection URI copied", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to copy Hysteria URI";
      setError(message);
      push(message, "error");
    } finally {
      setWorkingId(null);
    }
  }

  async function downloadConfig(user: HysteriaUser) {
    setWorkingId(user.id);
    try {
      const payload = await apiFetch<HysteriaUserArtifactsPayload>(`/api/hysteria/users/${user.id}/artifacts`);
      if (!payload.artifacts) {
        throw new Error(payload.access_message || "Hysteria access artifacts are unavailable for this user");
      }
      downloadTextFile(`${payload.user.username}-hysteria2.yaml`, payload.artifacts.client_config);
      push("Client config downloaded", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download client config";
      setError(message);
      push(message, "error");
    } finally {
      setWorkingId(null);
    }
  }

  async function setEnabled(user: HysteriaUser, enabled: boolean) {
    setWorkingId(user.id);
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${user.id}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      await load(false);
      push(enabled ? "User enabled" : "User disabled", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user state";
      setError(message);
      push(message, "error");
    } finally {
      setWorkingId(null);
    }
  }

  async function kickUser(user: HysteriaUser) {
    setWorkingId(user.id);
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${user.id}/kick`, {
        method: "POST",
        body: toJSONBody({}),
      });
      push("Live Hysteria session kicked", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to kick Hysteria session";
      setError(message);
      push(message, "error");
    } finally {
      setWorkingId(null);
    }
  }

  async function revokeUser() {
    if (!revokeTarget) {
      return;
    }
    setRevokeBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/hysteria/users/${revokeTarget.id}/revoke`, {
        method: "POST",
        body: toJSONBody({}),
      });
      push("User access revoked", "success");
      setRevokeTarget(null);
      await load(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke user";
      setError(message);
      push(message, "error");
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hysteria Users"
        icon={<Zap />}
        description="Manage real Hysteria 2 access identities. Generated URI, QR, and client config are derived from the same managed config that the panel writes to disk."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Create user
          </Button>
        }
      />

      <SectionNav items={tabs} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={String(users.length)} loading={loading} icon={<Users />} />
        <StatCard label="Enabled" value={String(overview?.enabled_users ?? 0)} loading={loading} icon={<Power />} />
        <StatCard label="Online" value={String(overview?.online_count ?? 0)} loading={loading} icon={<UserRound />} />
        <StatCard label="Traffic" value={formatBytes((overview?.total_tx_bytes ?? 0) + (overview?.total_rx_bytes ?? 0))} loading={loading} icon={<ShieldOff />} />
      </section>

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Access identities</CardTitle>
            <InputGroup className="w-full max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search username or note"
                aria-label="Search Hysteria users"
              />
              {search ? (
                <InputGroupAction aria-label="Clear search" onClick={() => setSearch("")}>
                  <X className="size-3.5" />
                </InputGroupAction>
              ) : null}
            </InputGroup>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState title="No Hysteria users" description="Create the first user to issue connection artifacts." icon={Zap} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState title="No matches" description="No users match the current search." icon={Zap} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const busy = workingId === user.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.username}</div>
                        <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">{user.note || "No note"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge tone={user.enabled ? "success" : "danger"}>{user.enabled ? "Enabled" : "Disabled"}</StatusBadge>
                          <StatusBadge tone={user.online_count > 0 ? "info" : "neutral"}>{user.online_count > 0 ? `${user.online_count} online` : "Offline"}</StatusBadge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Upload {formatBytes(user.last_tx_bytes)}</p>
                          <p>Download {formatBytes(user.last_rx_bytes)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(user.last_seen_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={busy || !user.enabled} onClick={() => void openPreview(user)}>
                            <QrCode className="size-4" />
                            Access
                          </Button>
                          <OverflowMenu
                            ariaLabel="User actions"
                            items={[
                              {
                                id: "edit",
                                label: "Edit",
                                icon: Pencil,
                                disabled: busy,
                                onSelect: () => openEdit(user),
                              },
                              {
                                id: "copy-uri",
                                label: "Copy URI",
                                icon: Copy,
                                disabled: busy || !user.enabled,
                                onSelect: () => {
                                  void copyURI(user);
                                },
                              },
                              {
                                id: "download-config",
                                label: "Download config",
                                icon: Download,
                                disabled: busy || !user.enabled,
                                onSelect: () => {
                                  void downloadConfig(user);
                                },
                              },
                              {
                                id: user.enabled ? "disable" : "enable",
                                label: user.enabled ? "Disable" : "Enable",
                                icon: Power,
                                disabled: busy,
                                onSelect: () => {
                                  void setEnabled(user, !user.enabled);
                                },
                              },
                              {
                                id: "kick",
                                label: "Kick session",
                                icon: MoreHorizontal,
                                disabled: busy || user.online_count === 0,
                                onSelect: () => {
                                  void kickUser(user);
                                },
                              },
                              {
                                id: "revoke",
                                label: "Revoke",
                                icon: UserRoundX,
                                destructive: true,
                                disabled: busy,
                                onSelect: () => setRevokeTarget(user),
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Hysteria user" : "Create Hysteria user"}
        description={editing ? "Update username, password, or note. Leave password empty to keep the current one." : "Create a per-user Hysteria access identity."}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={closeForm} disabled={formBusy}>
              Cancel
            </Button>
            <Button type="submit" form="hysteria-user-form" disabled={formBusy}>
              {formBusy ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <form id="hysteria-user-form" className="grid gap-4" onSubmit={submitForm} noValidate>
          <TextField
            label="Username"
            value={formState.username}
            error={formErrors.username}
            description="Lowercase only. Use a-z, 0-9, dot, dash, or underscore."
            onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))}
            placeholder="demo-user"
            disabled={formBusy}
          />
          <TextField
            label={editing ? "New password" : "Password"}
            value={formState.password}
            error={formErrors.password}
            description={editing ? "Optional. Leave empty to keep the current password." : "Optional. Leave empty to auto-generate a secure password."}
            onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
            placeholder="supersecret88"
            disabled={formBusy}
          />
          <TextareaField
            label="Note"
            value={formState.note}
            onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
            placeholder="Optional label or ownership note"
            disabled={formBusy}
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke Hysteria user"
        description={`Revoke ${revokeTarget?.username || "this user"}? Access will be removed from the managed Hysteria config and the user record will be deleted.`}
        confirmLabel="Revoke"
        onClose={() => setRevokeTarget(null)}
        onConfirm={revokeUser}
        busy={revokeBusy}
      />

      <Dialog
        open={Boolean(preview)}
        onClose={() => {
          setPreview(null);
          setPreviewError(null);
        }}
        title={preview ? `${preview.user.username} access` : "Hysteria access"}
        description="These artifacts are generated from the same managed config snapshot that the panel writes to the Hysteria server configuration."
        size="lg"
        actions={
          preview ? (
            <>
              <Button type="button" variant="outline" onClick={() => void copyToClipboard(preview.artifacts.uri).then(() => push("Connection URI copied", "success")).catch(() => push("Copy failed", "error"))}>
                <Copy className="size-4" />
                Copy URI
              </Button>
              <Button type="button" onClick={() => downloadTextFile(`${preview.user.username}-hysteria2.yaml`, preview.artifacts.client_config)}>
                <Download className="size-4" />
                Download config
              </Button>
            </>
          ) : null
        }
      >
        {previewBusy ? (
          <div className="space-y-3">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : previewError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load access artifacts</AlertTitle>
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        ) : preview ? (
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex items-center justify-center rounded-2xl border bg-muted/10 p-4">
              <img
                src={`/api/hysteria/users/${preview.user.id}/qr?size=360`}
                alt="Hysteria access QR"
                className="h-72 w-72 rounded-xl bg-white p-3 object-contain"
              />
            </div>
            <div className="space-y-4">
              <TextareaField label="Connection URI" value={preview.artifacts.uri} readOnly className="font-mono text-xs" />
              <TextareaField label="Client config" value={preview.artifacts.client_config} readOnly className="min-h-[220px] font-mono text-xs" />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function extractUserFormErrors(details: unknown): UserFormErrors {
  const errors: UserFormErrors = {};
  if (!Array.isArray(details)) {
    return errors;
  }
  for (const item of details as ValidationError[]) {
    if (item.field === "username") {
      errors.username = item.message;
    }
    if (item.field === "password") {
      errors.password = item.message;
    }
  }
  return errors;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}






