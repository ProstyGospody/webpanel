"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, PlayCircle, Save, SearchCheck, Shield, Users, Zap } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsPayload, Hy2SettingsValidation } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { SelectField, TextField, TextareaField } from "@/components/app/fields";
import { ConfirmDialog } from "@/components/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Zap },
];

type ProtectionMode = "none" | "obfs" | "masquerade";

const DEFAULT_SETTINGS: Hy2Settings = {
  listen: ":443",
  tlsEnabled: true,
  tlsMode: "acme",
  acme: { domains: [], email: "" },
  auth: { type: "password", password: "" },
  quicEnabled: false,
};

function toPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

function normalizeSettings(input: Hy2Settings | null | undefined): Hy2Settings {
  const next = { ...DEFAULT_SETTINGS, ...(input || {}) } as Hy2Settings;

  next.listen = (next.listen || "").trim() || ":443";
  next.tlsEnabled = next.tlsEnabled !== false;
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

  next.quicEnabled = Boolean(next.quicEnabled);
  next.quic = next.quic
    ? {
        initStreamReceiveWindow: toPositiveInt(next.quic.initStreamReceiveWindow),
        maxStreamReceiveWindow: toPositiveInt(next.quic.maxStreamReceiveWindow),
        initConnReceiveWindow: toPositiveInt(next.quic.initConnReceiveWindow),
        maxConnReceiveWindow: toPositiveInt(next.quic.maxConnReceiveWindow),
        maxIdleTimeout: (next.quic.maxIdleTimeout || "").trim(),
        maxIncomingStreams: toPositiveInt(next.quic.maxIncomingStreams),
        disablePathMTUDiscovery: Boolean(next.quic.disablePathMTUDiscovery),
      }
    : undefined;

  if (!next.quicEnabled) {
    next.quic = undefined;
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

function protectionModeFromSettings(settings: Hy2Settings): ProtectionMode {
  if (settings.obfs?.type) return "obfs";
  if (settings.masquerade?.type) return "masquerade";
  return "none";
}

function ValidationAlerts({ title, validation }: { title: string; validation: Hy2SettingsValidation | Hy2ConfigValidation | null }) {
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
  const [settings, setSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [publicHost, setPublicHost] = useState("");
  const [port, setPort] = useState("443");

  const [rawYaml, setRawYaml] = useState("");
  const [settingsValidation, setSettingsValidation] = useState<Hy2SettingsValidation | null>(null);
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
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

  const protectionMode = useMemo(() => protectionModeFromSettings(settings), [settings]);
  const isSettingsDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  function updateSetting<K extends keyof Hy2Settings>(key: K, value: Hy2Settings[K]) {
    setSettings((prev) => normalizeSettings({ ...prev, [key]: value }));
  }

  function getSettingsPayload(): Hy2Settings {
    const next = normalizeSettings(settings);
    const listenParts = parseListen(next.listen);
    next.listen = buildListen(listenParts.host, port);

    if (!next.tlsEnabled) {
      next.tls = undefined;
      next.acme = undefined;
    } else if (next.tlsMode === "acme") {
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

    if (!next.quicEnabled) {
      next.quic = undefined;
    } else {
      next.quic = {
        initStreamReceiveWindow: toPositiveInt(next.quic?.initStreamReceiveWindow),
        maxStreamReceiveWindow: toPositiveInt(next.quic?.maxStreamReceiveWindow),
        initConnReceiveWindow: toPositiveInt(next.quic?.initConnReceiveWindow),
        maxConnReceiveWindow: toPositiveInt(next.quic?.maxConnReceiveWindow),
        maxIdleTimeout: (next.quic?.maxIdleTimeout || "").trim(),
        maxIncomingStreams: toPositiveInt(next.quic?.maxIncomingStreams),
        disablePathMTUDiscovery: Boolean(next.quic?.disablePathMTUDiscovery),
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
      const hostFromSettings =
        normalizedSettings.tlsEnabled && normalizedSettings.tlsMode === "acme" ? normalizedSettings.acme?.domains?.[0] || "" : "";

      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setPort(listenParts.port || "443");
      setPublicHost(hostFromSettings || listenParts.host || "");

      setRawYaml(payload.raw_yaml || "");
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
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
      }>("/api/hy2/settings/validate", {
        method: "POST",
        body: toJSONBody(payloadSettings),
      });

      const normalizedSettings = normalizeSettings(payload.settings || payloadSettings);
      setSettings(normalizedSettings);
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
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
      }>("/api/hy2/config/validate", {
        method: "POST",
        body: toJSONBody({ content: rawYaml }),
      });

      const normalizedSettings = normalizeSettings(payload.settings);
      const listenParts = parseListen(normalizedSettings.listen);
      const hostFromSettings = normalizedSettings.tlsEnabled && normalizedSettings.tlsMode === "acme" ? normalizedSettings.acme?.domains?.[0] || "" : "";

      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setPort(listenParts.port || "443");
      setPublicHost(hostFromSettings || listenParts.host || "");
      setConfigValidation(payload.validation || null);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Hysteria settings" icon={<Zap />} description="Configure server, TLS, authentication and transport modes." />
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
          <AlertTitle>Unmanaged advanced fields detected</AlertTitle>
          <AlertDescription>Raw YAML contains fields outside managed UI.</AlertDescription>
        </Alert>
      )}

      <ValidationAlerts title="Server settings" validation={settingsValidation} />
      <ValidationAlerts title="Rendered config" validation={configValidation} />

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Server connection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-3 md:grid-cols-2">
          <TextField label="Port" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} placeholder="443" />
          <TextField label="Domain or host" value={publicHost} onChange={(e) => setPublicHost(e.target.value)} placeholder="hy2.example.com" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>TLS and certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="space-y-0.5">
              <Label>Enable TLS</Label>
              <p className="text-xs text-muted-foreground">Disable only for explicit non-TLS deployments.</p>
            </div>
            <Switch checked={settings.tlsEnabled} onCheckedChange={(checked) => updateSetting("tlsEnabled", Boolean(checked))} />
          </div>

          {settings.tlsEnabled ? (
            <>
              <Tabs
                value={settings.tlsMode}
                onValueChange={(value) => updateSetting("tlsMode", value === "tls" ? "tls" : "acme")}
                className="w-full"
              >
                <TabsList className="w-full md:w-auto">
                  <TabsTrigger value="acme">ACME</TabsTrigger>
                  <TabsTrigger value="tls">TLS files</TabsTrigger>
                </TabsList>
              </Tabs>

              {settings.tlsMode === "acme" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="ACME domain"
                    value={settings.acme?.domains?.[0] || publicHost}
                    onChange={(e) => { const value = e.target.value; setPublicHost(value); updateSetting("acme", { ...(settings.acme || {}), domains: [value] }); }}
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
                  <TextField
                    label="Certificate path"
                    value={settings.tls?.cert || ""}
                    onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), cert: e.target.value })}
                    placeholder="/etc/hysteria/cert.pem"
                  />
                  <TextField
                    label="Private key path"
                    value={settings.tls?.key || ""}
                    onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), key: e.target.value })}
                    placeholder="/etc/hysteria/key.pem"
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Enable TLS to configure certificates.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <Tabs
            value={settings.auth?.type || "password"}
            onValueChange={(value) => updateSetting("auth", { ...(settings.auth || {}), type: value === "http" ? "http" : "password" })}
            className="w-full"
          >
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="http">HTTP endpoint</TabsTrigger>
            </TabsList>
          </Tabs>

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
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Optional protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <Tabs
            value={protectionMode}
            onValueChange={(value) => {
              if (value === "obfs") {
                setSettings((prev) =>
                  normalizeSettings({
                    ...prev,
                    obfs: { type: "salamander", salamander: { password: prev.obfs?.salamander?.password || "" } },
                    masquerade: undefined,
                  })
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
                  })
                );
                return;
              }
              setSettings((prev) => normalizeSettings({ ...prev, obfs: undefined, masquerade: undefined }));
            }}
            className="w-full"
          >
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="none">None</TabsTrigger>
              <TabsTrigger value="obfs">OBFS</TabsTrigger>
              <TabsTrigger value="masquerade">Masquerade</TabsTrigger>
            </TabsList>
          </Tabs>

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
                description="Auto-generated on save if empty."
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
                label="Masquerade mode"
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
        <CardHeader className="border-b pb-3">
          <CardTitle>Advanced QUIC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="space-y-0.5">
              <Label>Use custom QUIC values</Label>
              <p className="text-xs text-muted-foreground">Disabled means stable defaults.</p>
            </div>
            <Switch checked={settings.quicEnabled} onCheckedChange={(checked) => updateSetting("quicEnabled", Boolean(checked))} />
          </div>

          {settings.quicEnabled && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="initStreamReceiveWindow"
                  value={settings.quic?.initStreamReceiveWindow ? String(settings.quic.initStreamReceiveWindow) : ""}
                  onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), initStreamReceiveWindow: toPositiveInt(e.target.value) })}
                  placeholder="8388608"
                />
                <TextField
                  label="maxStreamReceiveWindow"
                  value={settings.quic?.maxStreamReceiveWindow ? String(settings.quic.maxStreamReceiveWindow) : ""}
                  onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxStreamReceiveWindow: toPositiveInt(e.target.value) })}
                  placeholder="8388608"
                />
                <TextField
                  label="initConnReceiveWindow"
                  value={settings.quic?.initConnReceiveWindow ? String(settings.quic.initConnReceiveWindow) : ""}
                  onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), initConnReceiveWindow: toPositiveInt(e.target.value) })}
                  placeholder="20971520"
                />
                <TextField
                  label="maxConnReceiveWindow"
                  value={settings.quic?.maxConnReceiveWindow ? String(settings.quic.maxConnReceiveWindow) : ""}
                  onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxConnReceiveWindow: toPositiveInt(e.target.value) })}
                  placeholder="20971520"
                />
                <TextField
                  label="maxIdleTimeout"
                  value={settings.quic?.maxIdleTimeout || ""}
                  onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxIdleTimeout: e.target.value })}
                  placeholder="30s"
                />
                <TextField
                  label="maxIncomingStreams"
                  value={settings.quic?.maxIncomingStreams ? String(settings.quic.maxIncomingStreams) : ""}
                  onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxIncomingStreams: toPositiveInt(e.target.value) })}
                  placeholder="1024"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="space-y-0.5">
                  <Label>disablePathMTUDiscovery</Label>
                  <p className="text-xs text-muted-foreground">Use only if MTU discovery breaks traffic on your path.</p>
                </div>
                <Switch
                  checked={Boolean(settings.quic?.disablePathMTUDiscovery)}
                  onCheckedChange={(checked) => updateSetting("quic", { ...(settings.quic || {}), disablePathMTUDiscovery: Boolean(checked) })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pt-3">
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
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            Advanced / Raw YAML
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <Button variant="outline" onClick={() => setAdvancedOpen((prev) => !prev)}>
            <FileText className="size-4" />
            {advancedOpen ? "Hide raw YAML" : "Show raw YAML"}
          </Button>

          {advancedOpen && (
            <>
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
    </div>
  );
}

