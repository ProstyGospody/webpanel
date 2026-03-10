"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, OctagonAlert, PlayCircle, Save, SearchCheck, Settings, Users } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsPayload, Hy2SettingsValidation } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { SelectField, SwitchField, TextField } from "@/components/app/fields";
import { ConfirmDialog } from "@/components/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ValidatePayload = {
  settings_validation: Hy2SettingsValidation;
  config_validation: Hy2ConfigValidation;
};

const EMPTY_SETTINGS: Hy2Settings = {
  port: 443,
  sni: "",
  obfs_enabled: false,
  obfs_type: "salamander",
  obfs_password: "",
  masquerade_enabled: true,
  masquerade_type: "proxy",
  masquerade_url: "https://www.cloudflare.com",
  masquerade_rewrite_host: true,
};

const DEFAULT_OBFS_TYPE = "salamander";
const DEFAULT_MASQUERADE_TYPE = "proxy";
const DEFAULT_MASQUERADE_URL = "https://www.cloudflare.com";
const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Settings },
];

function generateObfsPassword(length = 18): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
  }

  let fallback = "";
  for (let i = 0; i < length; i += 1) {
    fallback += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  }
  return fallback;
}

type NormalizeOptions = {
  generateObfsPassword: boolean;
  prefer?: "obfs" | "masquerade";
};

function normalizeSettings(input: Hy2Settings, options: NormalizeOptions = { generateObfsPassword: false }): Hy2Settings {
  const next: Hy2Settings = {
    ...input,
    sni: (input.sni || "").trim(),
    obfs_type: (input.obfs_type || "").trim().toLowerCase(),
    obfs_password: (input.obfs_password || "").trim(),
    masquerade_type: (input.masquerade_type || "").trim().toLowerCase(),
    masquerade_url: (input.masquerade_url || "").trim(),
  };

  if (next.obfs_enabled && next.masquerade_enabled) {
    if (options.prefer === "masquerade") {
      next.obfs_enabled = false;
    } else {
      next.masquerade_enabled = false;
    }
  }

  if (next.obfs_enabled) {
    if (!next.obfs_type) {
      next.obfs_type = DEFAULT_OBFS_TYPE;
    }
    if (!next.obfs_password && options.generateObfsPassword) {
      next.obfs_password = generateObfsPassword();
    }
  } else {
    next.obfs_type = "";
    next.obfs_password = "";
  }

  if (next.masquerade_enabled) {
    if (!next.masquerade_type) {
      next.masquerade_type = DEFAULT_MASQUERADE_TYPE;
    }
    if (!next.masquerade_url) {
      next.masquerade_url = DEFAULT_MASQUERADE_URL;
    }
  } else {
    next.masquerade_type = "";
    next.masquerade_url = "";
  }

  return next;
}

export default function HysteriaSettingsPage() {
  const { push } = useToast();

  const [path, setPath] = useState("");
  const [settings, setSettings] = useState<Hy2Settings>(EMPTY_SETTINGS);
  const [settingsValidation, setSettingsValidation] = useState<Hy2SettingsValidation | null>(null);
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
  const [clientParams, setClientParams] = useState<Hy2SettingsPayload["client_params"] | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const payload = await apiFetch<Hy2SettingsPayload>("/api/hy2/settings");
      setPath(payload.path || "");
      setSettings(normalizeSettings(payload.settings || EMPTY_SETTINGS));
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      setClientParams(payload.client_params || null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings";
      setError(message);
      push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {
      // handled in load
    });
  }, []);

  const canSave = useMemo(() => {
    return settingsValidation ? settingsValidation.valid : true;
  }, [settingsValidation]);

  const obfsBlocked = settings.masquerade_enabled && !settings.obfs_enabled;
  const masqueradeBlocked = settings.obfs_enabled && !settings.masquerade_enabled;

  function update<K extends keyof Hy2Settings>(key: K, value: Hy2Settings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      const normalizeOptions: NormalizeOptions = { generateObfsPassword: false };

      if (key === "obfs_enabled" && Boolean(value)) {
        normalizeOptions.generateObfsPassword = true;
        normalizeOptions.prefer = "obfs";
      }

      if (key === "masquerade_enabled" && Boolean(value)) {
        normalizeOptions.prefer = "masquerade";
      }

      return normalizeSettings(next, normalizeOptions);
    });
  }

  async function validateSettings() {
    setValidating(true);
    try {
      const nextSettings = normalizeSettings(settings, { generateObfsPassword: true });
      setSettings(nextSettings);
      const payload = await apiFetch<ValidatePayload>("/api/hy2/settings/validate", {
        method: "POST",
        body: toJSONBody(nextSettings),
      });
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      push(payload.settings_validation?.valid ? "Validation passed" : "Validation failed", payload.settings_validation?.valid ? "success" : "error");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      setError(message);
      push(message, "error");
    } finally {
      setValidating(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const nextSettings = normalizeSettings(settings, { generateObfsPassword: true });
      setSettings(nextSettings);
      const payload = await apiFetch<Hy2SettingsPayload>("/api/hy2/settings", {
        method: "PUT",
        body: toJSONBody(nextSettings),
      });
      setPath(payload.path || "");
      setSettings(normalizeSettings(payload.settings || nextSettings));
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      setClientParams(payload.client_params || null);
      push("Settings saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
      push(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function applySettings() {
    setApplying(true);
    try {
      await apiFetch("/api/hy2/settings/apply", {
        method: "POST",
        body: toJSONBody({}),
      });
      setApplyConfirmOpen(false);
      push("Hysteria config applied", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply config";
      setError(message);
      push(message, "error");
    } finally {
      setApplying(false);
    }
  }

  const settingsIssues = settingsValidation?.errors || [];
  const settingsWarnings = settingsValidation?.warnings || [];
  const configIssues = configValidation?.errors || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hysteria"
        description="Configure runtime ingress, obfuscation modes and apply flow with explicit validation gates."
      />

      <SectionNav items={tabs} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Runtime source</CardTitle>
          <CardDescription>{path || "Config path is unavailable"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Port"
            type="number"
            min={1}
            max={65535}
            value={settings.port}
            onChange={(event) => update("port", Number(event.target.value || 0))}
            disabled={loading}
            description="Inbound listening port for hysteria-server."
          />

          <TextField
            label="SNI"
            value={settings.sni}
            onChange={(event) => update("sni", event.target.value)}
            disabled={loading}
            description="Primary TLS host advertised to clients."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transport modes</CardTitle>
          <CardDescription>OBFS and Masquerade are mutually exclusive runtime modes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchField
            id="obfs-enabled"
            label="OBFS"
            description={obfsBlocked ? "Disable Masquerade first to enable OBFS." : "Enable protocol obfuscation for compatible clients."}
            checked={settings.obfs_enabled}
            disabled={loading || obfsBlocked}
            onCheckedChange={(value) => update("obfs_enabled", value)}
          />

          {settings.obfs_enabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="OBFS type"
                value={settings.obfs_type || "salamander"}
                disabled={loading}
                description="Current UI supports salamander mode."
                onValueChange={(value) => update("obfs_type", value)}
                options={[{ value: "salamander", label: "salamander" }]}
              />
              <TextField
                label="OBFS password"
                value={settings.obfs_password || ""}
                onChange={(event) => update("obfs_password", event.target.value)}
                disabled={loading}
                placeholder="Auto-generated when empty"
                description="Generated automatically during validate/save when empty."
              />
            </div>
          )}

          <SwitchField
            id="masquerade-enabled"
            label="Masquerade"
            description={masqueradeBlocked ? "Disable OBFS first to enable Masquerade." : "Enable proxy camouflage mode for fallback-friendly ingress."}
            checked={settings.masquerade_enabled}
            disabled={loading || masqueradeBlocked}
            onCheckedChange={(value) => update("masquerade_enabled", value)}
          />

          {settings.masquerade_enabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Masquerade type"
                value={settings.masquerade_type || "proxy"}
                disabled={loading}
                description="Proxy mode is required by current backend validation."
                onValueChange={(value) => update("masquerade_type", value)}
                options={[{ value: "proxy", label: "proxy" }]}
              />
              <TextField
                label="Masquerade URL"
                value={settings.masquerade_url || ""}
                onChange={(event) => update("masquerade_url", event.target.value)}
                disabled={loading}
                placeholder="https://www.cloudflare.com"
                description="Absolute http/https URL used for camouflage target."
              />
              <div className="md:col-span-2">
                <SwitchField
                  id="masquerade-rewrite-host"
                  label="Rewrite host header"
                  description="Rewrite upstream host header while masquerade mode is active."
                  checked={settings.masquerade_rewrite_host}
                  disabled={loading}
                  onCheckedChange={(value) => update("masquerade_rewrite_host", value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Validate, Save, Apply</CardTitle>
            <CardDescription>Validation gates run before save. Apply triggers runtime restart.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" type="button" onClick={validateSettings} disabled={validating || loading}>
              <SearchCheck className="size-4" />
              {validating ? "Validating..." : "Validate"}
            </Button>
            <Button type="button" onClick={saveSettings} disabled={saving || !canSave || loading}>
              <Save className="size-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="destructive" type="button" onClick={() => setApplyConfirmOpen(true)} disabled={applying || loading}>
              <PlayCircle className="size-4" />
              {applying ? "Applying..." : "Apply / Restart"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {settingsIssues.length > 0 && (
            <Alert variant="destructive">
              <OctagonAlert className="size-4" />
              <AlertTitle>Settings validation errors</AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {settingsIssues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {settingsWarnings.length > 0 && (
            <Alert>
              <AlertTitle>Settings warnings</AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {settingsWarnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {configIssues.length > 0 && (
            <Alert variant="destructive">
              <OctagonAlert className="size-4" />
              <AlertTitle>Generated config issues</AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {configIssues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <StateChip title="Settings validation" value={settingsValidation?.valid ? "OK" : "Check fields"} tone={settingsValidation?.valid ? "success" : "warning"} />
            <StateChip title="Config validation" value={configValidation?.valid ? "OK" : "Check config"} tone={configValidation?.valid ? "success" : "warning"} />
            <StateChip title="Client port" value={String(clientParams?.port || "-")} tone="neutral" />
            <StateChip title="Client SNI" value={clientParams?.sni || "-"} tone="neutral" />
            <StateChip title="Client OBFS" value={clientParams?.obfs_type || "disabled"} tone="neutral" />
            <StateChip title="Source file" value={path || "-"} tone="neutral" />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={applyConfirmOpen}
        title="Apply and restart Hysteria"
        description="Current saved config will be applied and hysteria-server will restart. Continue?"
        confirmLabel="Apply"
        onClose={() => setApplyConfirmOpen(false)}
        onConfirm={applySettings}
        busy={applying}
      />
    </div>
  );
}

function StateChip({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "neutral" | "success" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <div className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        {tone !== "neutral" && <StatusBadge tone={tone}>{tone === "success" ? "Passed" : "Attention"}</StatusBadge>}
        {tone === "neutral" && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Runtime
          </span>
        )}
      </div>
    </div>
  );
}

