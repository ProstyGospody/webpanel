"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, PlayCircle, Save, SearchCheck, Shield, Users, Zap } from "lucide-react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsValidation, HysteriaSettingsPayload } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { SelectField, TextField, TextareaField } from "@/components/app/fields";
import { ConfirmDialog } from "@/components/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Zap },
];

type SettingsFormState = {
  listenHost: string;
  listenPort: string;
  tlsMode: "acme" | "tls" | "disabled";
  acmeDomain: string;
  acmeEmail: string;
  tlsCert: string;
  tlsKey: string;
  obfsEnabled: boolean;
  obfsPassword: string;
  masqueradeMode: "none" | "proxy" | "file" | "string";
  masqueradeValue: string;
  masqueradeStatusCode: string;
};

const DEFAULT_SETTINGS: Hy2Settings = {
  listen: ":443",
  tlsEnabled: true,
  tlsMode: "acme",
  acme: { domains: [], email: "" },
  auth: { type: "userpass", userpass: {} },
  quicEnabled: false,
};

export default function HysteriaSettingsPage() {
  const { push } = useToast();

  const [baseSettings, setBaseSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [form, setForm] = useState<SettingsFormState>(settingsToForm(DEFAULT_SETTINGS));
  const [rawYaml, setRawYaml] = useState("");
  const [settingsValidation, setSettingsValidation] = useState<Hy2SettingsValidation | null>(null);
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
  const [rawOnlyPaths, setRawOnlyPaths] = useState<string[]>([]);
  const [accessWarning, setAccessWarning] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validatingRaw, setValidatingRaw] = useState(false);
  const [savingRaw, setSavingRaw] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationMessages = useMemo(() => {
    const errors = [
      ...(settingsValidation?.errors || []),
      ...(configValidation?.errors || []),
    ];
    const warnings = [
      ...(settingsValidation?.warnings || []),
      ...(configValidation?.warnings || []),
    ];
    return {
      errors: Array.from(new Set(errors.filter(Boolean))),
      warnings: Array.from(new Set(warnings.filter(Boolean))),
    };
  }, [configValidation, settingsValidation]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const payload = await apiFetch<HysteriaSettingsPayload>("/api/hysteria/settings");
      applyPayload(payload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Hysteria settings";
      setError(message);
      push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  function applyPayload(payload: HysteriaSettingsPayload) {
    const nextSettings = normalizeSettings(payload.settings || DEFAULT_SETTINGS);
    setBaseSettings(nextSettings);
    setForm(settingsToForm(nextSettings));
    setRawYaml(payload.raw_yaml || "");
    setSettingsValidation(payload.settings_validation || null);
    setConfigValidation(payload.config_validation || null);
    setRawOnlyPaths(payload.raw_only_paths || []);
    setAccessWarning(payload.access_warning || "");
  }

  async function validateStructured() {
    setValidating(true);
    try {
      const payload = await apiFetch<HysteriaSettingsPayload>("/api/hysteria/settings/validate", {
        method: "POST",
        body: toJSONBody(buildSettingsPayload(baseSettings, form)),
      });
      applyPayload(payload);
      setError(null);
      push(payload.settings_validation?.valid && payload.config_validation?.valid ? "Validation passed" : "Validation returned issues", payload.settings_validation?.valid && payload.config_validation?.valid ? "success" : "info");
    } catch (err) {
      handleOperationError(err, "Failed to validate settings");
    } finally {
      setValidating(false);
    }
  }

  async function saveStructured() {
    setSaving(true);
    try {
      const payload = await apiFetch<HysteriaSettingsPayload>("/api/hysteria/settings", {
        method: "PUT",
        body: toJSONBody(buildSettingsPayload(baseSettings, form)),
      });
      applyPayload(payload);
      setError(null);
      push("Hysteria settings saved", "success");
    } catch (err) {
      handleOperationError(err, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function validateRawConfig() {
    setValidatingRaw(true);
    try {
      const payload = await apiFetch<{ content: string; validation: Hy2ConfigValidation; settings: Hy2Settings; raw_only_paths?: string[] }>("/api/hysteria/config/validate", {
        method: "POST",
        body: toJSONBody({ content: rawYaml }),
      });
      setRawYaml(payload.content || rawYaml);
      setBaseSettings(normalizeSettings(payload.settings));
      setForm(settingsToForm(normalizeSettings(payload.settings)));
      setConfigValidation(payload.validation || null);
      setRawOnlyPaths(payload.raw_only_paths || []);
      setError(null);
      push(payload.validation?.valid ? "YAML is valid" : "YAML has issues", payload.validation?.valid ? "success" : "info");
    } catch (err) {
      handleOperationError(err, "Failed to validate raw YAML");
    } finally {
      setValidatingRaw(false);
    }
  }

  async function saveRawConfig() {
    setSavingRaw(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/hysteria/config", {
        method: "PUT",
        body: toJSONBody({ content: rawYaml }),
      });
      await load();
      setError(null);
      push("Raw Hysteria config saved", "success");
    } catch (err) {
      handleOperationError(err, "Failed to save raw YAML");
    } finally {
      setSavingRaw(false);
    }
  }

  async function applySettings() {
    setApplying(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/hysteria/settings/apply", {
        method: "POST",
        body: toJSONBody({}),
      });
      setApplyOpen(false);
      await load();
      setError(null);
      push("Hysteria config applied", "success");
    } catch (err) {
      handleOperationError(err, "Failed to apply Hysteria config");
    } finally {
      setApplying(false);
    }
  }

  function handleOperationError(err: unknown, fallback: string) {
    if (err instanceof APIError) {
      const details = extractValidationDetails(err.details);
      if (details.settingsValidation) {
        setSettingsValidation(details.settingsValidation);
      }
      if (details.configValidation) {
        setConfigValidation(details.configValidation);
      }
    }
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    push(message, "error");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hysteria Settings"
        icon={<Zap />}
        description="Essential server settings live here. Access credentials are managed only from Hysteria Users; auth fields in raw YAML are overwritten during save/apply to prevent drift."
      />

      <SectionNav items={tabs} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {accessWarning ? (
        <Alert>
          <Shield className="size-4" />
          <AlertTitle>Managed access mode</AlertTitle>
          <AlertDescription>{accessWarning}</AlertDescription>
        </Alert>
      ) : null}

      {validationMessages.errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Validation issues</AlertTitle>
          <AlertDescription>{validationMessages.errors.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      {validationMessages.warnings.length > 0 ? (
        <Alert>
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>{validationMessages.warnings.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      {rawOnlyPaths.length > 0 ? (
        <Alert>
          <AlertTitle>Advanced/raw fields detected</AlertTitle>
          <AlertDescription>{`These fields are preserved in raw YAML: ${rawOnlyPaths.join(", ")}`}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Network</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-3 md:grid-cols-2">
              <TextField
                label="Listen host"
                value={form.listenHost}
                onChange={(event) => setForm((current) => ({ ...current, listenHost: event.target.value }))}
                placeholder="0.0.0.0"
                disabled={loading}
              />
              <TextField
                label="Listen port"
                value={form.listenPort}
                onChange={(event) => setForm((current) => ({ ...current, listenPort: event.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="443"
                disabled={loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>TLS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <SelectField
                label="TLS mode"
                value={form.tlsMode}
                onValueChange={(value) => setForm((current) => ({ ...current, tlsMode: value as SettingsFormState["tlsMode"] }))}
                options={[
                  { value: "acme", label: "Auto certificate (ACME)" },
                  { value: "tls", label: "TLS cert/key files" },
                  { value: "disabled", label: "Disabled" },
                ]}
                disabled={loading}
              />

              {form.tlsMode === "acme" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Primary domain"
                    value={form.acmeDomain}
                    onChange={(event) => setForm((current) => ({ ...current, acmeDomain: event.target.value }))}
                    placeholder="hy2.example.com"
                    disabled={loading}
                  />
                  <TextField
                    label="ACME email"
                    value={form.acmeEmail}
                    onChange={(event) => setForm((current) => ({ ...current, acmeEmail: event.target.value }))}
                    placeholder="admin@example.com"
                    disabled={loading}
                  />
                </div>
              ) : null}

              {form.tlsMode === "tls" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Certificate path"
                    value={form.tlsCert}
                    onChange={(event) => setForm((current) => ({ ...current, tlsCert: event.target.value }))}
                    placeholder="/etc/hysteria/server.crt"
                    disabled={loading}
                  />
                  <TextField
                    label="Private key path"
                    value={form.tlsKey}
                    onChange={(event) => setForm((current) => ({ ...current, tlsKey: event.target.value }))}
                    placeholder="/etc/hysteria/server.key"
                    disabled={loading}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Optional protection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Salamander obfuscation</p>
                  <p className="text-xs text-muted-foreground">Client artifacts will include this password when enabled.</p>
                </div>
                <Switch
                  checked={form.obfsEnabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, obfsEnabled: Boolean(checked) }))}
                  disabled={loading}
                />
              </div>
              {form.obfsEnabled ? (
                <TextField
                  label="Obfuscation password"
                  value={form.obfsPassword}
                  onChange={(event) => setForm((current) => ({ ...current, obfsPassword: event.target.value }))}
                  placeholder="managed-obfs-password"
                  disabled={loading}
                />
              ) : null}

              <SelectField
                label="Masquerade mode"
                value={form.masqueradeMode}
                onValueChange={(value) => setForm((current) => ({ ...current, masqueradeMode: value as SettingsFormState["masqueradeMode"] }))}
                options={[
                  { value: "none", label: "Disabled" },
                  { value: "proxy", label: "Reverse proxy URL" },
                  { value: "file", label: "Static files" },
                  { value: "string", label: "Inline response" },
                ]}
                disabled={loading}
              />

              {form.masqueradeMode === "proxy" ? (
                <TextField
                  label="Proxy URL"
                  value={form.masqueradeValue}
                  onChange={(event) => setForm((current) => ({ ...current, masqueradeValue: event.target.value }))}
                  placeholder="https://example.org"
                  disabled={loading}
                />
              ) : null}

              {form.masqueradeMode === "file" ? (
                <TextField
                  label="Static directory"
                  value={form.masqueradeValue}
                  onChange={(event) => setForm((current) => ({ ...current, masqueradeValue: event.target.value }))}
                  placeholder="/var/www/html"
                  disabled={loading}
                />
              ) : null}

              {form.masqueradeMode === "string" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Inline response"
                    value={form.masqueradeValue}
                    onChange={(event) => setForm((current) => ({ ...current, masqueradeValue: event.target.value }))}
                    placeholder="OK"
                    disabled={loading}
                  />
                  <TextField
                    label="Status code"
                    value={form.masqueradeStatusCode}
                    onChange={(event) => setForm((current) => ({ ...current, masqueradeStatusCode: event.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder="200"
                    disabled={loading}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 self-start xl:sticky xl:top-20">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Structured actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                Normal UI keeps the common settings manageable. QUIC tuning and any raw-only fields stay in advanced YAML and are preserved across structured saves.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void validateStructured()} disabled={validating || loading}>
                  <SearchCheck className="size-4" />
                  {validating ? "Validating..." : "Validate"}
                </Button>
                <Button onClick={() => void saveStructured()} disabled={saving || loading}>
                  <Save className="size-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => setApplyOpen(true)} disabled={applying || loading}>
                  <PlayCircle className="size-4" />
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Advanced / Raw YAML
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                Raw YAML is the place for advanced overrides. Auth fields in raw YAML are not authoritative and will be replaced by managed Hysteria users during validate/save/apply.
              </div>
              <Button variant="outline" onClick={() => setShowRaw((current) => !current)} disabled={loading}>
                {showRaw ? "Hide raw YAML" : "Show raw YAML"}
              </Button>
              {showRaw ? (
                <div className="space-y-4">
                  <TextareaField
                    label="server.yaml"
                    value={rawYaml}
                    onChange={(event) => setRawYaml(event.target.value)}
                    className="min-h-[420px] font-mono text-xs"
                    disabled={loading}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => void validateRawConfig()} disabled={validatingRaw || loading}>
                      <SearchCheck className="size-4" />
                      {validatingRaw ? "Validating..." : "Validate YAML"}
                    </Button>
                    <Button onClick={() => void saveRawConfig()} disabled={savingRaw || loading}>
                      <Save className="size-4" />
                      {savingRaw ? "Saving..." : "Save YAML"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={applyOpen}
        title="Apply Hysteria config"
        description="Restart hysteria-server using the current saved managed configuration?"
        confirmLabel="Apply"
        onClose={() => setApplyOpen(false)}
        onConfirm={applySettings}
        busy={applying}
        danger={false}
      />
    </div>
  );
}

function settingsToForm(settings: Hy2Settings): SettingsFormState {
  const { host, port } = parseListen(settings.listen || ":443");
  return {
    listenHost: host,
    listenPort: port,
    tlsMode: !settings.tlsEnabled ? "disabled" : settings.tlsMode === "tls" ? "tls" : "acme",
    acmeDomain: settings.acme?.domains?.[0] || "",
    acmeEmail: settings.acme?.email || "",
    tlsCert: settings.tls?.cert || "",
    tlsKey: settings.tls?.key || "",
    obfsEnabled: settings.obfs?.type === "salamander",
    obfsPassword: settings.obfs?.salamander?.password || "",
    masqueradeMode: settings.masquerade?.type === "proxy" || settings.masquerade?.type === "file" || settings.masquerade?.type === "string" ? settings.masquerade.type : "none",
    masqueradeValue:
      settings.masquerade?.type === "proxy"
        ? settings.masquerade.proxy?.url || ""
        : settings.masquerade?.type === "file"
          ? settings.masquerade.file?.dir || ""
          : settings.masquerade?.type === "string"
            ? settings.masquerade.string?.content || ""
            : "",
    masqueradeStatusCode: settings.masquerade?.type === "string" && settings.masquerade.string?.statusCode ? String(settings.masquerade.string.statusCode) : "",
  };
}

function buildSettingsPayload(baseSettings: Hy2Settings, form: SettingsFormState): Hy2Settings {
  const next = cloneSettings(normalizeSettings(baseSettings));
  const currentMasquerade = next.masquerade;
  next.listen = buildListen(form.listenHost, form.listenPort);
  next.auth = { type: "userpass", userpass: {} };

  if (form.tlsMode === "disabled") {
    next.tlsEnabled = false;
    next.tlsMode = "acme";
    next.tls = undefined;
    next.acme = undefined;
  } else if (form.tlsMode === "tls") {
    next.tlsEnabled = true;
    next.tlsMode = "tls";
    next.tls = {
      cert: form.tlsCert.trim(),
      key: form.tlsKey.trim(),
    };
    next.acme = undefined;
  } else {
    next.tlsEnabled = true;
    next.tlsMode = "acme";
    next.tls = undefined;
    next.acme = {
      domains: form.acmeDomain.trim() ? [form.acmeDomain.trim()] : [],
      email: form.acmeEmail.trim(),
    };
  }

  next.obfs = form.obfsEnabled
    ? {
        type: "salamander",
        salamander: { password: form.obfsPassword.trim() },
      }
    : undefined;

  if (form.masqueradeMode === "none") {
    next.masquerade = undefined;
  } else if (form.masqueradeMode === "proxy") {
    next.masquerade = {
      type: "proxy",
      proxy: {
        url: form.masqueradeValue.trim(),
        rewriteHost: currentMasquerade?.proxy?.rewriteHost,
        insecure: currentMasquerade?.proxy?.insecure,
      },
      listenHTTP: currentMasquerade?.listenHTTP,
      listenHTTPS: currentMasquerade?.listenHTTPS,
      forceHTTPS: currentMasquerade?.forceHTTPS,
    };
  } else if (form.masqueradeMode === "file") {
    next.masquerade = {
      type: "file",
      file: { dir: form.masqueradeValue.trim() },
      listenHTTP: currentMasquerade?.listenHTTP,
      listenHTTPS: currentMasquerade?.listenHTTPS,
      forceHTTPS: currentMasquerade?.forceHTTPS,
    };
  } else {
    next.masquerade = {
      type: "string",
      string: {
        content: form.masqueradeValue,
        statusCode: Number(form.masqueradeStatusCode || 0) || undefined,
        headers: currentMasquerade?.string?.headers,
      },
      listenHTTP: currentMasquerade?.listenHTTP,
      listenHTTPS: currentMasquerade?.listenHTTPS,
      forceHTTPS: currentMasquerade?.forceHTTPS,
    };
  }

  return next;
}

function cloneSettings(settings: Hy2Settings): Hy2Settings {
  return JSON.parse(JSON.stringify(settings)) as Hy2Settings;
}

function normalizeSettings(settings: Hy2Settings): Hy2Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    auth: settings.auth || { type: "userpass", userpass: {} },
  };
}

function parseListen(listen: string): { host: string; port: string } {
  const value = (listen || "").trim();
  if (!value) {
    return { host: "", port: "443" };
  }
  if (value.startsWith(":")) {
    return { host: "", port: value.slice(1) || "443" };
  }
  if (value.startsWith("[")) {
    const idx = value.lastIndexOf("]:");
    if (idx > -1) {
      return { host: value.slice(1, idx), port: value.slice(idx + 2) || "443" };
    }
  }
  const idx = value.lastIndexOf(":");
  if (idx > -1) {
    return { host: value.slice(0, idx), port: value.slice(idx + 1) || "443" };
  }
  return { host: value, port: "443" };
}

function buildListen(host: string, port: string): string {
  const safeHost = host.trim();
  const safePort = port.trim() || "443";
  if (!safeHost) {
    return `:${safePort}`;
  }
  if (safeHost.includes(":") && !safeHost.startsWith("[")) {
    return `[${safeHost}]:${safePort}`;
  }
  return `${safeHost}:${safePort}`;
}

function extractValidationDetails(details: unknown): {
  settingsValidation?: Hy2SettingsValidation;
  configValidation?: Hy2ConfigValidation;
} {
  if (!details || typeof details !== "object") {
    return {};
  }
  const record = details as Record<string, unknown>;
  if (Array.isArray(record.errors) || Array.isArray(record.warnings)) {
    return {
      settingsValidation: record as unknown as Hy2SettingsValidation,
      configValidation: record as unknown as Hy2ConfigValidation,
    };
  }
  return {};
}


