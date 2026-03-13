"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Copy, Link2, Save, SearchCheck, Send, Settings2 } from "lucide-react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { MTProxyAccess, MTProxyOverview, MTProxySettings, MTProxySettingsResponse, ServiceDetails, ValidationError } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { TextField } from "@/components/app/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type SettingsFormState = {
  enabled: boolean;
  publicHost: string;
  listenPort: string;
  canonicalSecret: string;
  proxyTag: string;
};

type SettingsFormErrors = {
  publicHost?: string;
  listenPort?: string;
  canonicalSecret?: string;
  shareMode?: string;
};

const tabs = [
  { href: "/mtproxy/settings", label: "Settings", icon: Settings2 },
  { href: "/mtproxy/access", label: "Access", icon: Link2 },
];

const EMPTY_FORM: SettingsFormState = {
  enabled: false,
  publicHost: "",
  listenPort: "443",
  canonicalSecret: "",
  proxyTag: "",
};

export default function MTProxySettingsPage() {
  const { push } = useToast();

  const [settings, setSettings] = useState<MTProxySettings | null>(null);
  const [access, setAccess] = useState<MTProxyAccess | null>(null);
  const [overview, setOverview] = useState<MTProxyOverview | null>(null);
  const [service, setService] = useState<ServiceDetails | null>(null);
  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<SettingsFormErrors>({});

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceTone = useMemo(() => statusTone(service?.status_text || ""), [service?.status_text]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [settingsPayload, overviewPayload, servicePayload] = await Promise.all([
        apiFetch<MTProxySettingsResponse>("/api/mtproxy/settings"),
        apiFetch<MTProxyOverview>("/api/mtproxy/stats/overview"),
        apiFetch<ServiceDetails>("/api/services/mtproxy?lines=1"),
      ]);
      applySettingsResponse(settingsPayload);
      setOverview(overviewPayload);
      setService(servicePayload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load MTProxy settings";
      setError(message);
      push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  function applySettingsResponse(payload: MTProxySettingsResponse) {
    setSettings(payload.settings);
    setAccess(payload.access || null);
    setForm({
      enabled: payload.settings.enabled,
      publicHost: payload.settings.public_host || "",
      listenPort: String(payload.settings.listen_port || 443),
      canonicalSecret: payload.settings.canonical_secret || "",
      proxyTag: payload.settings.proxy_tag || "",
    });
    setFormErrors({});
  }

  async function validateSettings() {
    setValidating(true);
    setFormErrors({});
    try {
      const payload = await apiFetch<MTProxySettingsResponse>("/api/mtproxy/settings/validate", {
        method: "POST",
        body: toJSONBody(buildPayload(form)),
      });
      applySettingsResponse(payload);
      setError(null);
      push("Validation passed", "success");
    } catch (err) {
      handleSettingsError(err, "Failed to validate MTProxy settings");
    } finally {
      setValidating(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setFormErrors({});
    try {
      const payload = await apiFetch<MTProxySettingsResponse>("/api/mtproxy/settings", {
        method: "PUT",
        body: toJSONBody(buildPayload(form)),
      });
      applySettingsResponse(payload);
      setError(null);
      push("MTProxy settings saved", "success");
      await load();
    } catch (err) {
      handleSettingsError(err, "Failed to save MTProxy settings");
    } finally {
      setSaving(false);
    }
  }

  function handleSettingsError(err: unknown, fallback: string) {
    if (err instanceof APIError) {
      setFormErrors(extractSettingsErrors(err.details));
    }
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    push(message, "error");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MTProxy Settings"
        icon={<Send />}
        description="MTProxy uses one shared canonical secret. This panel does not create per-user MTProxy accounts; it manages a single shared access configuration and generates canonical Telegram links from it."
      />

      <SectionNav items={tabs} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <AlertTitle>Shared access model</AlertTitle>
        <AlertDescription>Telegram users connect through one shared MTProxy secret. Save validates the host, port, and secret and then applies the runtime update safely.</AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Connection settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Enable MTProxy access</p>
                  <p className="text-xs text-muted-foreground">Disabling removes the runtime secret and share link.</p>
                </div>
                <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: Boolean(checked) }))} disabled={loading} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Public host"
                  value={form.publicHost}
                  error={formErrors.publicHost}
                  onChange={(event) => setForm((current) => ({ ...current, publicHost: event.target.value }))}
                  placeholder="proxy.example.com"
                  disabled={loading}
                />
                <TextField
                  label="Port"
                  value={form.listenPort}
                  error={formErrors.listenPort}
                  onChange={(event) => setForm((current) => ({ ...current, listenPort: event.target.value.replace(/[^0-9]/g, "") }))}
                  placeholder="443"
                  disabled={loading}
                />
              </div>

              <TextField
                label="Canonical secret"
                value={form.canonicalSecret}
                error={formErrors.canonicalSecret}
                description="Store one canonical 32-char hex secret. Legacy dd/ee formats are normalized on save."
                onChange={(event) => setForm((current) => ({ ...current, canonicalSecret: event.target.value }))}
                placeholder="aabbccddeeff00112233445566778899"
                disabled={loading}
              />

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <TextField
                  label="Proxy tag"
                  value={form.proxyTag}
                  onChange={(event) => setForm((current) => ({ ...current, proxyTag: event.target.value }))}
                  placeholder="Optional"
                  disabled={loading}
                />
                <div className="flex items-end">
                  <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, canonicalSecret: generateSecret() }))} disabled={loading}>
                    <Copy className="size-4" />
                    Generate secret
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 self-start xl:sticky xl:top-20">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard label="Access" value={overview?.access_enabled ? "Enabled" : "Disabled"} loading={loading} icon={<Link2 />} />
            <StatCard label="Connections" value={String(overview?.connections_total ?? 0)} loading={loading} icon={<Activity />} />
          </section>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Service status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-3">
              <StatusBadge tone={serviceTone}>{service?.status_text || (loading ? "Loading" : "Unknown")}</StatusBadge>
              <p className="text-xs text-muted-foreground">Updated {formatDate(service?.checked_at || null)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Access preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">Primary share link uses the canonical <code>https://t.me/proxy</code> format. The access page exposes copy buttons and QR from the same stored settings.</div>
              <TextField label="Share mode" value="telegram" readOnly disabled />
              <TextField label="Share URL preview" value={access?.telegram_url || "Access link will appear after successful validation/save."} readOnly disabled />
              <TextField label="Deep link" value={access?.telegram_deep_url || "tg:// link preview will appear here."} readOnly disabled />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void validateSettings()} disabled={validating || loading}>
                  <SearchCheck className="size-4" />
                  {validating ? "Validating..." : "Validate"}
                </Button>
                <Button onClick={() => void saveSettings()} disabled={saving || loading}>
                  <Save className="size-4" />
                  {saving ? "Saving..." : "Save & apply"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function buildPayload(form: SettingsFormState): MTProxySettings {
  return {
    enabled: form.enabled,
    public_host: form.publicHost.trim(),
    listen_port: Number(form.listenPort || 0),
    canonical_secret: form.canonicalSecret.trim(),
    share_mode: "telegram",
    proxy_tag: form.proxyTag.trim() || null,
    created_at: "",
    updated_at: "",
  } as MTProxySettings;
}

function extractSettingsErrors(details: unknown): SettingsFormErrors {
  const errors: SettingsFormErrors = {};
  if (!Array.isArray(details)) {
    return errors;
  }
  for (const item of details as ValidationError[]) {
    if (item.field === "public_host") {
      errors.publicHost = item.message;
    }
    if (item.field === "listen_port") {
      errors.listenPort = item.message;
    }
    if (item.field === "canonical_secret") {
      errors.canonicalSecret = item.message;
    }
    if (item.field === "share_mode") {
      errors.shareMode = item.message;
    }
  }
  return errors;
}

function generateSecret(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join("");
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "success";
  }
  if (normalized.includes("reload") || normalized.includes("activating")) {
    return "warning";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "danger";
  }
  return "neutral";
}
