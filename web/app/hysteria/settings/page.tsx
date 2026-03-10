"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, FileText, PlayCircle, QrCode, Save, SearchCheck, Settings, Shield, Users } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type {
  Hy2ClientArtifacts,
  Hy2ClientProfile,
  Hy2ClientValidation,
  Hy2ConfigValidation,
  Hy2Settings,
  Hy2SettingsPayload,
  Hy2SettingsValidation,
} from "@/lib/types";
import { copyToClipboard } from "@/lib/format";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { SelectField, TextField, TextareaField } from "@/components/app/fields";
import { ConfirmDialog } from "@/components/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Settings },
];

type ProtectionMode = "none" | "obfs" | "masquerade";

const DEFAULT_SETTINGS: Hy2Settings = {
  listen: ":443",
  tlsMode: "acme",
  acme: { domains: [], email: "" },
  auth: { type: "password", password: "" },
};

function normalizeSettings(input: Hy2Settings | null | undefined): Hy2Settings {
  const next = { ...DEFAULT_SETTINGS, ...(input || {}) } as Hy2Settings;

  next.listen = (next.listen || "").trim() || ":443";
  next.tlsMode = (next.tlsMode || "acme").toLowerCase() === "tls" ? "tls" : "acme";

  next.tls = next.tls
    ? {
        cert: (next.tls.cert || "").trim(),
        key: (next.tls.key || "").trim(),
      }
    : undefined;

  next.acme = {
    domains: (next.acme?.domains || []).map((item) => item.trim()).filter(Boolean),
    email: (next.acme?.email || "").trim(),
  };

  next.auth = {
    type: (next.auth?.type || "password").toLowerCase() === "http" ? "http" : "password",
    password: (next.auth?.password || "").trim(),
    http: {
      url: (next.auth?.http?.url || "").trim(),
      insecure: Boolean(next.auth?.http?.insecure),
    },
  };

  if (next.obfs?.type) {
    next.obfs = {
      type: "salamander",
      salamander: { password: (next.obfs.salamander?.password || "").trim() },
    };
  } else {
    next.obfs = undefined;
  }

  if (next.masquerade?.type) {
    const type = ["proxy", "file", "string"].includes(next.masquerade.type) ? next.masquerade.type : "proxy";
    next.masquerade = {
      type,
      file: { dir: (next.masquerade.file?.dir || "").trim() },
      proxy: { url: (next.masquerade.proxy?.url || "").trim() },
      string: {
        content: (next.masquerade.string?.content || "").trim(),
        statusCode: Number(next.masquerade.string?.statusCode || 0) || undefined,
      },
    };
  } else {
    next.masquerade = undefined;
  }

  return next;
}

function parseListen(listen: string): { host: string; port: string } {
  const value = (listen || "").trim();
  if (!value) return { host: "", port: "443" };
  if (value.startsWith(":")) {
    return { host: "", port: value.slice(1).trim() || "443" };
  }
  if (value.startsWith("[")) {
    const idx = value.lastIndexOf("]:");
    if (idx > -1) {
      return { host: value.slice(1, idx).trim(), port: value.slice(idx + 2).trim() || "443" };
    }
  }
  const idx = value.lastIndexOf(":");
  if (idx > 0) {
    return { host: value.slice(0, idx).trim(), port: value.slice(idx + 1).trim() || "443" };
  }
  return { host: value, port: "443" };
}

function buildListen(host: string, port: string): string {
  const safePort = (port || "443").trim() || "443";
  const safeHost = (host || "").trim();
  if (!safeHost) return `:${safePort}`;
  if (safeHost.includes(":") && !safeHost.startsWith("[")) {
    return `[${safeHost}]:${safePort}`;
  }
  return `${safeHost}:${safePort}`;
}

function serverHostFromProfile(profile: Hy2ClientProfile | null | undefined): string {
  const server = (profile?.server || "").trim();
  if (!server) return "";
  if (server.startsWith("[")) {
    const idx = server.lastIndexOf("]:");
    return idx > -1 ? server.slice(1, idx).trim() : server.replace(/^[\[]|[\]]$/g, "").trim();
  }
  const idx = server.lastIndexOf(":");
  return idx > 0 ? server.slice(0, idx).trim() : server;
}

function protectionModeFromSettings(settings: Hy2Settings): ProtectionMode {
  if (settings.obfs?.type) return "obfs";
  if (settings.masquerade?.type) return "masquerade";
  return "none";
}

function ValidationAlerts({ title, validation }: { title: string; validation: Hy2SettingsValidation | Hy2ConfigValidation | Hy2ClientValidation | null }) {
  if (!validation) return null;
  return (
    <div className="space-y-3">
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{title}: errors</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul>
          </AlertDescription>
        </Alert>
      )}
      {validation.warnings.length > 0 && (
        <Alert>
          <AlertTitle>{title}: warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">{validation.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function generateSecret(size = 16): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(size);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

export default function HysteriaSettingsPage() {
  const { push } = useToast();

  const [path, setPath] = useState("");
  const [settings, setSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [publicHost, setPublicHost] = useState("");
  const [port, setPort] = useState("443");

  const [rawYaml, setRawYaml] = useState("");
  const [settingsValidation, setSettingsValidation] = useState<Hy2SettingsValidation | null>(null);
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
  const [clientArtifacts, setClientArtifacts] = useState<Hy2ClientArtifacts | null>(null);
  const [clientValidation, setClientValidation] = useState<Hy2ClientValidation | null>(null);
  const [rawOnlyPaths, setRawOnlyPaths] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validatingYaml, setValidatingYaml] = useState(false);
  const [savingYaml, setSavingYaml] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const protectionMode = useMemo(() => protectionModeFromSettings(settings), [settings]);

  const isSettingsDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  const qrCodeURL = useMemo(() => {
    const uri = clientArtifacts?.uri || "";
    if (!uri) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uri)}`;
  }, [clientArtifacts?.uri]);

  function markCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
  }

  function updateSetting<K extends keyof Hy2Settings>(key: K, value: Hy2Settings[K]) {
    setSettings((prev) => normalizeSettings({ ...prev, [key]: value }));
  }

  function getSettingsPayload(): Hy2Settings {
    const next = normalizeSettings(settings);
    const listenParts = parseListen(next.listen);
    next.listen = buildListen(listenParts.host, port);

    if (next.tlsMode === "acme") {
      const domain = (publicHost || next.acme?.domains?.[0] || "").trim();
      next.acme = {
        domains: domain ? [domain] : [],
        email: (next.acme?.email || "").trim(),
      };
      next.tls = undefined;
    } else {
      next.tls = {
        cert: (next.tls?.cert || "").trim(),
        key: (next.tls?.key || "").trim(),
      };
      next.acme = undefined;
    }

    if ((next.auth.type || "password") === "http") {
      next.auth = {
        type: "http",
        http: { url: (next.auth.http?.url || "").trim(), insecure: Boolean(next.auth.http?.insecure) },
      };
    } else {
      next.auth = {
        type: "password",
        password: (next.auth.password || "").trim(),
      };
    }

    if (protectionMode === "none") {
      next.obfs = undefined;
      next.masquerade = undefined;
    }

    if (protectionMode === "obfs") {
      next.obfs = {
        type: "salamander",
        salamander: {
          password: (next.obfs?.salamander?.password || "").trim(),
        },
      };
      next.masquerade = undefined;
    }

    if (protectionMode === "masquerade") {
      next.obfs = undefined;
      next.masquerade = {
        type: next.masquerade?.type || "proxy",
        file: { dir: (next.masquerade?.file?.dir || "").trim() },
        proxy: { url: (next.masquerade?.proxy?.url || "").trim() },
        string: {
          content: (next.masquerade?.string?.content || "").trim(),
          statusCode: Number(next.masquerade?.string?.statusCode || 0) || undefined,
        },
      };
    }

    return normalizeSettings(next);
  }

  async function load() {
    setLoading(true);
    try {
      const payload = await apiFetch<Hy2SettingsPayload>("/api/hy2/settings");
      const normalizedSettings = normalizeSettings(payload.settings);
      const listenParts = parseListen(normalizedSettings.listen);
      const hostFromSettings = normalizedSettings.acme?.domains?.[0] || "";
      const hostFromProfile = serverHostFromProfile(payload.client_profile);

      setPath(payload.path || "");
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setPort(listenParts.port || "443");
      setPublicHost(hostFromSettings || hostFromProfile);

      setRawYaml(payload.raw_yaml || "");
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      setClientArtifacts(payload.client_artifacts || null);
      setClientValidation(payload.client_validation || null);
      setRawOnlyPaths(payload.raw_only_paths || payload.config_validation?.rawOnlyPaths || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Hysteria settings";
      setError(message);
      push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function validateSettingsAction() {
    setValidating(true);
    try {
      const payloadSettings = getSettingsPayload();
      const payload = await apiFetch<{
        settings: Hy2Settings;
        settings_validation: Hy2SettingsValidation;
        config_validation: Hy2ConfigValidation;
        raw_yaml: string;
        client_artifacts: Hy2ClientArtifacts;
        client_validation: Hy2ClientValidation;
      }>("/api/hy2/settings/validate", {
        method: "POST",
        body: toJSONBody(payloadSettings),
      });

      const normalizedSettings = normalizeSettings(payload.settings || payloadSettings);
      setSettings(normalizedSettings);
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      setClientArtifacts(payload.client_artifacts || null);
      setClientValidation(payload.client_validation || null);
      setRawYaml(payload.raw_yaml || rawYaml);
      setRawOnlyPaths(payload.config_validation?.rawOnlyPaths || []);
      setError(null);

      const ok = Boolean(payload.settings_validation?.valid && payload.config_validation?.valid);
      push(ok ? "Validation passed" : "Validation failed", ok ? "success" : "error");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      setError(message);
      push(message, "error");
    } finally {
      setValidating(false);
    }
  }

  async function saveSettingsAction() {
    setSaving(true);
    try {
      const payloadSettings = getSettingsPayload();
      if (protectionMode === "obfs" && !payloadSettings.obfs?.salamander?.password) {
        payloadSettings.obfs = {
          type: "salamander",
          salamander: { password: generateSecret(16) },
        };
      }
      await apiFetch<Hy2SettingsPayload>("/api/hy2/settings", {
        method: "PUT",
        body: toJSONBody(payloadSettings),
      });
      await load();
      push("Settings saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
      push(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function applySettingsAction() {
    setApplying(true);
    try {
      await apiFetch("/api/hy2/settings/apply", { method: "POST", body: toJSONBody({}) });
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

  async function validateRawYAMLAction() {
    setValidatingYaml(true);
    try {
      const payload = await apiFetch<{
        validation: Hy2ConfigValidation;
        settings: Hy2Settings;
        client_profile: Hy2ClientProfile;
        client_artifacts: Hy2ClientArtifacts;
        client_validation: Hy2ClientValidation;
      }>("/api/hy2/config/validate", {
        method: "POST",
        body: toJSONBody({ content: rawYaml }),
      });

      const normalizedSettings = normalizeSettings(payload.settings);
      const listenParts = parseListen(normalizedSettings.listen);
      const hostFromSettings = normalizedSettings.acme?.domains?.[0] || "";
      const hostFromProfile = serverHostFromProfile(payload.client_profile);

      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setPort(listenParts.port || "443");
      setPublicHost(hostFromSettings || hostFromProfile);
      setConfigValidation(payload.validation || null);
      setClientArtifacts(payload.client_artifacts || null);
      setClientValidation(payload.client_validation || null);
      setRawOnlyPaths(payload.validation?.rawOnlyPaths || []);
      setError(null);

      push(payload.validation?.valid ? "YAML is valid" : "YAML has validation issues", payload.validation?.valid ? "success" : "error");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to validate YAML";
      setError(message);
      push(message, "error");
    } finally {
      setValidatingYaml(false);
    }
  }

  async function saveRawYAMLAction() {
    setSavingYaml(true);
    try {
      await apiFetch("/api/hy2/config", { method: "PUT", body: toJSONBody({ content: rawYaml }) });
      await load();
      push("Raw YAML saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save YAML";
      setError(message);
      push(message, "error");
    } finally {
      setSavingYaml(false);
    }
  }

  async function copyValue(value: string, key: string) {
    try {
      await copyToClipboard(value);
      markCopied(key);
      push("Copied", "success");
    } catch {
      push("Copy failed", "error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Hysteria" description="Minimal Hysteria 2 settings with stable defaults and clean client output." />
      <SectionNav items={tabs} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rawOnlyPaths.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Advanced fields detected</AlertTitle>
          <AlertDescription>
            This config has unmanaged YAML fields. Basic form edits keep them, but advanced behavior should be reviewed in Raw YAML.
          </AlertDescription>
        </Alert>
      )}

      <ValidationAlerts title="Server settings" validation={settingsValidation} />
      <ValidationAlerts title="Rendered config" validation={configValidation} />
      <ValidationAlerts title="Client artifacts" validation={clientValidation} />

      <Card>
        <CardHeader>
          <CardTitle>Server Connection</CardTitle>
          <CardDescription>Minimal public endpoint settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TextField label="Port" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} placeholder="443" />
          <TextField
            label="Domain / Host"
            value={publicHost}
            onChange={(e) => setPublicHost(e.target.value)}
            description="Used in ACME and client output."
            placeholder="hy2.example.com"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificate Setup</CardTitle>
          <CardDescription>Choose one certificate mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            label="Certificate mode"
            value={settings.tlsMode}
            onValueChange={(value) => updateSetting("tlsMode", value === "tls" ? "tls" : "acme")}
            options={[
              { value: "acme", label: "ACME" },
              { value: "tls", label: "TLS files" },
            ]}
          />

          {settings.tlsMode === "acme" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="ACME domain"
                value={settings.acme?.domains?.[0] || publicHost}
                onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), domains: [e.target.value] })}
                placeholder="hy2.example.com"
              />
              <TextField
                label="ACME email"
                value={settings.acme?.email || ""}
                onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="TLS cert path" value={settings.tls?.cert || ""} onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), cert: e.target.value })} placeholder="/etc/hysteria/cert.pem" />
              <TextField label="TLS key path" value={settings.tls?.key || ""} onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), key: e.target.value })} placeholder="/etc/hysteria/key.pem" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Only modes needed for practical server use.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            label="Auth mode"
            value={settings.auth?.type || "password"}
            onValueChange={(value) => updateSetting("auth", { ...(settings.auth || {}), type: value === "http" ? "http" : "password" })}
            options={[
              { value: "password", label: "Password" },
              { value: "http", label: "HTTP endpoint" },
            ]}
          />

          {(settings.auth?.type || "password") === "password" ? (
            <TextField
              label="Auth secret"
              value={settings.auth?.password || ""}
              onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), password: e.target.value })}
              placeholder="strong-shared-secret"
            />
          ) : (
            <TextField
              label="HTTP auth URL"
              value={settings.auth?.http?.url || ""}
              onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), http: { ...(settings.auth?.http || {}), url: e.target.value } })}
              placeholder="http://127.0.0.1:18080/internal/hy2/auth/<token>"
              description="Used by panel-managed users flow."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optional Protection</CardTitle>
          <CardDescription>Choose one mode to avoid ambiguous behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            label="Protection mode"
            value={protectionMode}
            onValueChange={(value) => {
              if (value === "obfs") {
                setSettings((prev) =>
                  normalizeSettings({
                    ...prev,
                    obfs: { type: "salamander", salamander: { password: prev.obfs?.salamander?.password || "" } },
                    masquerade: undefined,
                  }),
                );
                return;
              }
              if (value === "masquerade") {
                setSettings((prev) =>
                  normalizeSettings({
                    ...prev,
                    obfs: undefined,
                    masquerade: prev.masquerade?.type
                      ? prev.masquerade
                      : { type: "proxy", proxy: { url: "" }, file: { dir: "" }, string: { content: "" } },
                  }),
                );
                return;
              }
              setSettings((prev) => normalizeSettings({ ...prev, obfs: undefined, masquerade: undefined }));
            }}
            options={[
              { value: "none", label: "None" },
              { value: "obfs", label: "OBFS" },
              { value: "masquerade", label: "Masquerade" },
            ]}
          />

          {protectionMode === "obfs" && (
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <TextField
                label="OBFS password"
                value={settings.obfs?.salamander?.password || ""}
                onChange={(e) =>
                  updateSetting("obfs", {
                    type: "salamander",
                    salamander: { password: e.target.value },
                  })
                }
                description="If empty, it will be generated automatically on save."
                placeholder="salamander-secret"
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateSetting("obfs", {
                      type: "salamander",
                      salamander: { password: generateSecret(16) },
                    })
                  }
                >
                  Generate
                </Button>
              </div>
            </div>
          )}

          {protectionMode === "masquerade" && (
            <div className="space-y-4">
              <SelectField
                label="Masquerade type"
                value={settings.masquerade?.type || "proxy"}
                onValueChange={(value) =>
                  updateSetting("masquerade", {
                    ...(settings.masquerade || {}),
                    type: value,
                  })
                }
                options={[
                  { value: "proxy", label: "Proxy target" },
                  { value: "file", label: "Static files" },
                  { value: "string", label: "Inline response" },
                ]}
              />

              {(settings.masquerade?.type || "proxy") === "proxy" && (
                <TextField
                  label="Proxy URL"
                  value={settings.masquerade?.proxy?.url || ""}
                  onChange={(e) =>
                    updateSetting("masquerade", {
                      ...(settings.masquerade || {}),
                      type: "proxy",
                      proxy: { ...(settings.masquerade?.proxy || {}), url: e.target.value },
                    })
                  }
                  placeholder="https://example.org"
                />
              )}

              {(settings.masquerade?.type || "proxy") === "file" && (
                <TextField
                  label="Static directory"
                  value={settings.masquerade?.file?.dir || ""}
                  onChange={(e) =>
                    updateSetting("masquerade", {
                      ...(settings.masquerade || {}),
                      type: "file",
                      file: { ...(settings.masquerade?.file || {}), dir: e.target.value },
                    })
                  }
                  placeholder="/var/www/html"
                />
              )}

              {(settings.masquerade?.type || "proxy") === "string" && (
                <>
                  <TextField
                    label="Response content"
                    value={settings.masquerade?.string?.content || ""}
                    onChange={(e) =>
                      updateSetting("masquerade", {
                        ...(settings.masquerade || {}),
                        type: "string",
                        string: { ...(settings.masquerade?.string || {}), content: e.target.value },
                      })
                    }
                    placeholder="OK"
                  />
                  <TextField
                    label="Status code"
                    value={String(settings.masquerade?.string?.statusCode || "")}
                    onChange={(e) =>
                      updateSetting("masquerade", {
                        ...(settings.masquerade || {}),
                        type: "string",
                        string: {
                          ...(settings.masquerade?.string || {}),
                          statusCode: Number(e.target.value || 0) || undefined,
                        },
                      })
                    }
                    placeholder="200"
                  />
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Validate, save managed settings, then apply runtime restart.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void validateSettingsAction()} disabled={validating || loading}>
            <SearchCheck className="size-4" />
            {validating ? "Validating..." : "Validate"}
          </Button>
          <Button onClick={() => void saveSettingsAction()} disabled={saving || loading || (!isSettingsDirty && settingsValidation?.valid)}>
            <Save className="size-4" />
            {saving ? "Saving..." : "Save settings"}
          </Button>
          <Button variant="secondary" onClick={() => setApplyConfirmOpen(true)} disabled={applying || loading}>
            <PlayCircle className="size-4" />
            Apply config
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client Output</CardTitle>
          <CardDescription>Generated from server settings with a stable baseline template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextareaField label="hysteria2 URI" value={clientArtifacts?.uri || ""} readOnly className="font-mono text-xs" />
          <TextareaField label="hy2 URI" value={clientArtifacts?.uriHy2 || ""} readOnly className="font-mono text-xs" />
          {qrCodeURL && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <QrCode className="size-4" />
                QR
              </div>
              <img src={qrCodeURL} alt="Hysteria URI QR" className="h-56 w-56 rounded-md border bg-white p-2" />
            </div>
          )}
          <TextareaField label="client.yaml" value={clientArtifacts?.clientYAML || ""} readOnly className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyValue(clientArtifacts?.uri || "", "uri")}>{copiedKey === "uri" ? "Copied" : "Copy URI"}</Button>
            <Button variant="outline" size="sm" onClick={() => void copyValue(clientArtifacts?.uriHy2 || "", "uri-hy2")}>{copiedKey === "uri-hy2" ? "Copied" : "Copy hy2://"}</Button>
            <Button variant="outline" size="sm" onClick={() => void copyValue(clientArtifacts?.clientYAML || "", "client-yaml")}>{copiedKey === "client-yaml" ? "Copied" : "Copy client YAML"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            Advanced / Raw YAML
          </CardTitle>
          <CardDescription>
            Unmanaged low-level options. Use only when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => setAdvancedOpen((prev) => !prev)}>
            <FileText className="size-4" />
            {advancedOpen ? "Hide Advanced YAML" : "Show Advanced YAML"}
          </Button>

          {advancedOpen && (
            <>
              <div className="text-xs text-muted-foreground">Path: {path || "-"}</div>
              <TextareaField label="server.yaml" value={rawYaml} onChange={(e) => setRawYaml(e.target.value)} className="min-h-[380px] font-mono text-xs" />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void validateRawYAMLAction()} disabled={validatingYaml || loading}>
                  <SearchCheck className="size-4" />
                  {validatingYaml ? "Validating..." : "Validate YAML"}
                </Button>
                <Button onClick={() => void saveRawYAMLAction()} disabled={savingYaml || loading}>
                  <Save className="size-4" />
                  {savingYaml ? "Saving..." : "Save YAML"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={applyConfirmOpen}
        title="Apply Hysteria config"
        description="Restart hysteria-server with current saved config?"
        confirmLabel="Apply"
        onClose={() => setApplyConfirmOpen(false)}
        onConfirm={applySettingsAction}
        busy={applying}
      />

      {loading && (
        <Alert>
          <AlertTitle>Loading</AlertTitle>
          <AlertDescription>Fetching current Hysteria configuration...</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
