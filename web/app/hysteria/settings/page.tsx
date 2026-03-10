"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, PlayCircle, Save, SearchCheck, Shield, Users, Zap } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsPayload, Hy2SettingsValidation } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { TextField, TextareaField } from "@/components/app/fields";
import { ConfirmDialog } from "@/components/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Zap },
];

type ProtectionMode = "none" | "obfs" | "masquerade";
type TLSMode = "disabled" | "acme" | "tls";
type AuthMode = "password" | "http";
type MasqueradeMode = "proxy" | "file" | "string";
type QuicMode = "default" | "custom";

type ModeOption = {
  value: string;
  label: string;
  description: string;
};

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
      proxy: { ...(next.masquerade.proxy || {}), url: (next.masquerade.proxy?.url || "").trim() },
      string: {
        ...(next.masquerade.string || {}),
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

function ModeCards({
  value,
  onChange,
  options,
  columnsClassName = "md:grid-cols-3",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ModeOption[];
  columnsClassName?: string;
}) {
  return (
    <div className={cn("grid gap-2", columnsClassName)} role="radiogroup">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left transition-colors",
              active ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-background hover:bg-muted/35"
            )}
          >
            <p className="text-sm font-medium leading-none">{option.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
          </button>
        );
      })}
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
  const [listenHost, setListenHost] = useState("");
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
  const tlsMode: TLSMode = !settings.tlsEnabled ? "disabled" : settings.tlsMode === "tls" ? "tls" : "acme";
  const authMode: AuthMode = settings.auth?.type === "http" ? "http" : "password";
  const masqueradeMode: MasqueradeMode =
    settings.masquerade?.type === "file" ? "file" : settings.masquerade?.type === "string" ? "string" : "proxy";
  const quicMode: QuicMode = settings.quicEnabled ? "custom" : "default";
  const isSettingsDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  function updateSetting<K extends keyof Hy2Settings>(key: K, value: Hy2Settings[K]) {
    setSettings((prev) => normalizeSettings({ ...prev, [key]: value }));
  }

  function setTLSMode(mode: TLSMode) {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev });
      if (mode === "disabled") {
        next.tlsEnabled = false;
        next.tls = undefined;
        next.acme = undefined;
        return normalizeSettings(next);
      }

      next.tlsEnabled = true;
      if (mode === "acme") {
        next.tlsMode = "acme";
        next.tls = undefined;
        next.acme = {
          domains: next.acme?.domains?.length ? next.acme.domains : [],
          email: next.acme?.email || "",
        };
      } else {
        next.tlsMode = "tls";
        next.acme = undefined;
        next.tls = {
          cert: next.tls?.cert || "",
          key: next.tls?.key || "",
        };
      }

      return normalizeSettings(next);
    });
  }

  function setAuthMode(mode: AuthMode) {
    if (mode === "http") {
      updateSetting("auth", {
        type: "http",
        http: {
          url: settings.auth?.http?.url || "",
          insecure: Boolean(settings.auth?.http?.insecure),
        },
      });
      return;
    }

    updateSetting("auth", {
      type: "password",
      password: settings.auth?.password || "",
    });
  }

  function setProtectionMode(mode: ProtectionMode) {
    if (mode === "obfs") {
      setSettings((prev) =>
        normalizeSettings({
          ...prev,
          obfs: { type: "salamander", salamander: { password: prev.obfs?.salamander?.password || "" } },
          masquerade: undefined,
        })
      );
      return;
    }

    if (mode === "masquerade") {
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
  }

  function setMasqueradeMode(mode: MasqueradeMode) {
    updateSetting("masquerade", {
      ...(settings.masquerade || {}),
      type: mode,
      file: { ...(settings.masquerade?.file || {}), dir: settings.masquerade?.file?.dir || "" },
      proxy: { ...(settings.masquerade?.proxy || {}), url: settings.masquerade?.proxy?.url || "" },
      string: {
        ...(settings.masquerade?.string || {}),
        content: settings.masquerade?.string?.content || "",
        statusCode: settings.masquerade?.string?.statusCode,
      },
    });
  }

  function setQuicMode(mode: QuicMode) {
    if (mode === "default") {
      setSettings((prev) => normalizeSettings({ ...prev, quicEnabled: false, quic: undefined }));
      return;
    }

    setSettings((prev) =>
      normalizeSettings({
        ...prev,
        quicEnabled: true,
        quic: prev.quic || { maxIdleTimeout: "30s" },
      })
    );
  }

  function getSettingsPayload(): Hy2Settings {
    const next = normalizeSettings(settings);
    next.listen = buildListen(listenHost, port);

    if (!next.tlsEnabled) {
      next.tls = undefined;
      next.acme = undefined;
    } else if (next.tlsMode === "acme") {
      const domain = (next.acme?.domains?.[0] || "").trim();
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
        ...(next.masquerade || {}),
        type: next.masquerade?.type || "proxy",
        file: { dir: (next.masquerade?.file?.dir || "").trim() },
        proxy: { ...(next.masquerade?.proxy || {}), url: (next.masquerade?.proxy?.url || "").trim() },
        string: {
          ...(next.masquerade?.string || {}),
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

      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setListenHost(listenParts.host || "");
      setPort(listenParts.port || "443");

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


      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setListenHost(listenParts.host || "");
      setPort(listenParts.port || "443");
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

  const tlsSummary = tlsMode === "disabled" ? "Disabled" : tlsMode === "acme" ? "ACME" : "TLS files";
  const authSummary = authMode === "password" ? "Password" : "HTTP endpoint";
  const protectionSummary = protectionMode === "none" ? "None" : protectionMode === "obfs" ? "OBFS" : `Masquerade (${masqueradeMode})`;
  const quicSummary = quicMode === "default" ? "Stable defaults" : "Custom values";

  return (
    <div className="space-y-6">
      <PageHeader title="Hysteria settings" icon={<Zap />} description="Server configuration for Hysteria 2." />
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
          <AlertDescription>Some options are managed only in Raw YAML.</AlertDescription>
        </Alert>
      )}

      <ValidationAlerts title="Server settings" validation={settingsValidation} />
      <ValidationAlerts title="Rendered config" validation={configValidation} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Basic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Port"
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="443"
                  disabled={loading}
                />
                <TextField
                  label="Listen host"
                  value={listenHost}
                  onChange={(e) => setListenHost(e.target.value)}
                  placeholder="0.0.0.0"
                  description="Leave empty to listen on all interfaces."
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>TLS / Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <ModeCards
                value={tlsMode}
                onChange={(value) => setTLSMode(value as TLSMode)}
                options={[
                  { value: "acme", label: "ACME", description: "Automatic certificate." },
                  { value: "tls", label: "TLS files", description: "Use cert and key files." },
                  { value: "disabled", label: "Disabled", description: "Do not manage TLS here." },
                ]}
              />

              {tlsMode === "acme" && (
                <div className="rounded-lg border bg-muted/10 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField
                      label="ACME domain"
                      value={settings.acme?.domains?.[0] || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateSetting("acme", { ...(settings.acme || {}), domains: value ? [value] : [] });
                      }}
                      placeholder="hy2.example.com"
                      disabled={loading}
                    />
                    <TextField
                      label="ACME email"
                      value={settings.acme?.email || ""}
                      onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), email: e.target.value })}
                      placeholder="admin@example.com"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {tlsMode === "tls" && (
                <div className="rounded-lg border bg-muted/10 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField
                      label="Certificate path"
                      value={settings.tls?.cert || ""}
                      onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), cert: e.target.value })}
                      placeholder="/etc/hysteria/cert.pem"
                      disabled={loading}
                    />
                    <TextField
                      label="Private key path"
                      value={settings.tls?.key || ""}
                      onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), key: e.target.value })}
                      placeholder="/etc/hysteria/key.pem"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {tlsMode === "disabled" && (
                <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">TLS blocks are managed in Raw YAML only.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <ModeCards
                value={authMode}
                onChange={(value) => setAuthMode(value as AuthMode)}
                columnsClassName="md:grid-cols-2"
                options={[
                  { value: "password", label: "Password", description: "Shared secret." },
                  { value: "http", label: "HTTP endpoint", description: "External auth webhook." },
                ]}
              />

              {authMode === "password" ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <TextField
                    label="Auth secret"
                    value={settings.auth?.password || ""}
                    onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), password: e.target.value })}
                    placeholder="strong-shared-secret"
                    disabled={loading}
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateSetting("auth", { ...(settings.auth || {}), password: generateSecret(16) })}
                      disabled={loading}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <TextField
                    label="HTTP auth URL"
                    value={settings.auth?.http?.url || ""}
                    onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), http: { ...(settings.auth?.http || {}), url: e.target.value } })}
                    placeholder="http://127.0.0.1:18080/internal/hy2/auth/<token>"
                    disabled={loading}
                  />
                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
                    <div className="space-y-0.5">
                      <Label>Allow insecure TLS for auth endpoint</Label>
                    </div>
                    <Switch
                      checked={Boolean(settings.auth?.http?.insecure)}
                      onCheckedChange={(checked) =>
                        updateSetting("auth", {
                          ...(settings.auth || {}),
                          http: { ...(settings.auth?.http || {}), insecure: Boolean(checked) },
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Optional protection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <ModeCards
                value={protectionMode}
                onChange={(value) => setProtectionMode(value as ProtectionMode)}
                options={[
                  { value: "none", label: "None", description: "No extra layer." },
                  { value: "obfs", label: "OBFS", description: "Salamander obfuscation." },
                  { value: "masquerade", label: "Masquerade", description: "Serve decoy traffic." },
                ]}
              />

              {protectionMode === "none" && (
                <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">OBFS and masquerade are disabled.</p>
              )}

              {protectionMode === "obfs" && (
                <div className="grid gap-4 rounded-lg border bg-muted/10 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <TextField
                    label="OBFS password"
                    value={settings.obfs?.salamander?.password || ""}
                    onChange={(e) =>
                      updateSetting("obfs", {
                        type: "salamander",
                        salamander: { password: e.target.value },
                      })
                    }
                    description="Generated automatically on save if empty."
                    placeholder="salamander-secret"
                    disabled={loading}
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
                      disabled={loading}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              )}

              {protectionMode === "masquerade" && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <ModeCards
                    value={masqueradeMode}
                    onChange={(value) => setMasqueradeMode(value as MasqueradeMode)}
                    options={[
                      { value: "proxy", label: "Proxy target", description: "Forward requests to an upstream URL." },
                      { value: "file", label: "Static files", description: "Serve files from a local directory." },
                      { value: "string", label: "Inline response", description: "Return a fixed body/status response." },
                    ]}
                  />

                  {masqueradeMode === "proxy" && (
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
                      disabled={loading}
                    />
                  )}

                  {masqueradeMode === "file" && (
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
                      disabled={loading}
                    />
                  )}

                  {masqueradeMode === "string" && (
                    <div className="grid gap-4 md:grid-cols-2">
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
                        disabled={loading}
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
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Advanced QUIC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <ModeCards
                value={quicMode}
                onChange={(value) => setQuicMode(value as QuicMode)}
                columnsClassName="md:grid-cols-2"
                options={[
                  { value: "default", label: "Stable defaults", description: "Recommended." },
                  { value: "custom", label: "Custom QUIC", description: "Manual tuning." },
                ]}
              />

              {quicMode === "default" && (
                <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Using default QUIC values.</p>
              )}

              {quicMode === "custom" && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField
                      label="Initial stream window"
                      value={settings.quic?.initStreamReceiveWindow ? String(settings.quic.initStreamReceiveWindow) : ""}
                      onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), initStreamReceiveWindow: toPositiveInt(e.target.value) })}
                      placeholder="8388608"
                      disabled={loading}
                    />
                    <TextField
                      label="Maximum stream window"
                      value={settings.quic?.maxStreamReceiveWindow ? String(settings.quic.maxStreamReceiveWindow) : ""}
                      onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxStreamReceiveWindow: toPositiveInt(e.target.value) })}
                      placeholder="8388608"
                      disabled={loading}
                    />
                    <TextField
                      label="Initial connection window"
                      value={settings.quic?.initConnReceiveWindow ? String(settings.quic.initConnReceiveWindow) : ""}
                      onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), initConnReceiveWindow: toPositiveInt(e.target.value) })}
                      placeholder="20971520"
                      disabled={loading}
                    />
                    <TextField
                      label="Maximum connection window"
                      value={settings.quic?.maxConnReceiveWindow ? String(settings.quic.maxConnReceiveWindow) : ""}
                      onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxConnReceiveWindow: toPositiveInt(e.target.value) })}
                      placeholder="20971520"
                      disabled={loading}
                    />
                    <TextField
                      label="Max idle timeout"
                      value={settings.quic?.maxIdleTimeout || ""}
                      onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxIdleTimeout: e.target.value })}
                      placeholder="30s"
                      disabled={loading}
                    />
                    <TextField
                      label="Max incoming streams"
                      value={settings.quic?.maxIncomingStreams ? String(settings.quic.maxIncomingStreams) : ""}
                      onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxIncomingStreams: toPositiveInt(e.target.value) })}
                      placeholder="1024"
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
                    <div className="space-y-0.5">
                      <Label>Disable path MTU discovery</Label>
                    </div>
                    <Switch
                      checked={Boolean(settings.quic?.disablePathMTUDiscovery)}
                      onCheckedChange={(checked) =>
                        updateSetting("quic", {
                          ...(settings.quic || {}),
                          disablePathMTUDiscovery: Boolean(checked),
                        })
                      }
                      disabled={loading}
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
            <CardContent className="space-y-4 pt-3">
              <div className="rounded-lg border bg-muted/15 px-3 py-3 text-sm">
                <p className="font-medium">Current profile</p>
                <p className="mt-1 text-muted-foreground">
                  TLS: {tlsSummary} | Auth: {authSummary} | Protection: {protectionSummary} | QUIC: {quicSummary}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void saveSettingsAction()} disabled={saving || loading || !isSettingsDirty}>
                  <Save className="size-4" />
                  {saving ? "Saving..." : "Save settings"}
                </Button>
                <Button variant="outline" onClick={() => void validateSettingsAction()} disabled={validating || loading}>
                  <SearchCheck className="size-4" />
                  {validating ? "Validating..." : "Validate"}
                </Button>
                <Button variant="secondary" onClick={() => setApplyConfirmOpen(true)} disabled={applying || loading}>
                  <PlayCircle className="size-4" />
                  Apply config
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4" />
                Advanced / Raw config
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Unmanaged YAML</p>
                </div>
                <Button variant="outline" onClick={() => setAdvancedOpen((prev) => !prev)} disabled={loading}>
                  <FileText className="size-4" />
                  {advancedOpen ? "Hide raw YAML" : "Show raw YAML"}
                </Button>
              </div>

              {advancedOpen && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-3">
                  <TextareaField
                    label="server.yaml"
                    value={rawYaml}
                    onChange={(e) => setRawYaml(e.target.value)}
                    className="min-h-[380px] font-mono text-xs"
                  />
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
