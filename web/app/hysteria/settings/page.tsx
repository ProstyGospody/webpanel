"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsPayload, Hy2SettingsValidation } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Button, Card, InlineMessage, PageHeader, SwitchField, TextField } from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { useToast } from "@/components/toast-provider";
import { SectionTabs } from "@/components/section-tabs";

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
  { href: "/hysteria/users", label: "Users", icon: "group" },
  { href: "/hysteria/settings", label: "Settings", icon: "settings" },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hysteria 2"
        subtitle="Native runtime settings: port, SNI, OBFS and Masquerade with validation-first apply flow."
      />

      <SectionTabs items={tabs} />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Runtime source" subtitle={path || "-"}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Port"
            type="number"
            min={1}
            max={65535}
            value={settings.port}
            onChange={(event) => update("port", Number(event.target.value || 0))}
            disabled={loading}
          />

          <TextField
            label="SNI"
            value={settings.sni}
            onChange={(event) => update("sni", event.target.value)}
            disabled={loading}
          />
        </div>
      </Card>

      <Card title="OBFS" subtitle="Optional transport obfuscation. Incompatible with Masquerade.">
        <SwitchField
          label="Enable OBFS"
          supportingText="When enabled, Masquerade is disabled automatically."
          checked={settings.obfs_enabled}
          onChange={(value) => update("obfs_enabled", value)}
          disabled={loading}
        />

        {settings.obfs_enabled && (
          <div className="grid gap-4 md:grid-cols-2" style={{ marginTop: 8 }}>
            <label className="grid gap-2">
              <span className="text-sm font-medium">OBFS type</span>
              <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" value={settings.obfs_type || "salamander"} onChange={(event) => update("obfs_type", event.target.value)}>
                <option value="salamander">salamander</option>
              </select>
              <span className="text-xs text-muted-foreground">Secure obfuscation mode used by compatible clients.</span>
            </label>

            <TextField
              label="OBFS password"
              value={settings.obfs_password || ""}
              onChange={(event) => update("obfs_password", event.target.value)}
              placeholder="Auto-generated when empty"
              supportingText="Generated automatically on validation/save if empty."
            />
          </div>
        )}
      </Card>

      <Card title="Masquerade" subtitle="Proxy mode URL camouflage. Incompatible with OBFS.">
        <SwitchField
          label="Enable Masquerade"
          supportingText="When enabled, OBFS is disabled automatically."
          checked={settings.masquerade_enabled}
          onChange={(value) => update("masquerade_enabled", value)}
          disabled={loading}
        />

        {settings.masquerade_enabled && (
          <div className="grid gap-4 md:grid-cols-2" style={{ marginTop: 8 }}>
            <TextField
              label="Masquerade URL"
              value={settings.masquerade_url || ""}
              onChange={(event) => update("masquerade_url", event.target.value)}
              placeholder="https://www.cloudflare.com"
              supportingText="Target URL used for traffic camouflage."
            />

            <SwitchField
              label="rewriteHost"
              supportingText="Rewrite host header when masquerade mode is active."
              checked={settings.masquerade_rewrite_host}
              onChange={(value) => update("masquerade_rewrite_host", value)}
            />
          </div>
        )}
      </Card>

      <Card
        title="Apply flow"
        subtitle="Validate, save, then apply runtime config with explicit confirmation."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outlined" type="button" onClick={validateSettings} disabled={validating || loading}>
              {validating ? "Validating..." : "Validate"}
            </Button>
            <Button type="button" onClick={saveSettings} disabled={saving || !canSave || loading}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="danger" type="button" onClick={() => setApplyConfirmOpen(true)} disabled={applying || loading}>
              {applying ? "Applying..." : "Apply / Restart"}
            </Button>
          </div>
        }
      >
        {settingsValidation && settingsValidation.errors.length > 0 && (
          <InlineMessage tone="error">
            {settingsValidation.errors.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </InlineMessage>
        )}

        {settingsValidation && settingsValidation.warnings.length > 0 && (
          <InlineMessage tone="warning">
            {settingsValidation.warnings.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </InlineMessage>
        )}

        {configValidation && configValidation.errors.length > 0 && (
          <InlineMessage tone="error">
            {configValidation.errors.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </InlineMessage>
        )}

        <div className="grid gap-4 md:grid-cols-2" style={{ marginTop: 12 }}>
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground">Validation: {settingsValidation?.valid ? "OK" : "Check fields"}</div>
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground">Config: {configValidation?.valid ? "OK" : "Check config"}</div>
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground">Updated: {formatDate(new Date().toISOString())}</div>
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground">Client port: {clientParams?.port || "-"}</div>
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground">Client SNI: {clientParams?.sni || "-"}</div>
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground">Client OBFS: {clientParams?.obfs_type || "disabled"}</div>
        </div>
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


