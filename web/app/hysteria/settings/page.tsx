"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, FileText, PlayCircle, QrCode, Save, SearchCheck, Server, Settings, Sparkles, Users } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Settings },
];

const DEFAULT_SETTINGS: Hy2Settings = {
  listen: ":443",
  disableUDP: false,
  udpIdleTimeout: "",
  ignoreClientBandwidth: false,
  speedTest: false,
  tlsMode: "acme",
  acme: { domains: [], email: "", type: "http" },
  auth: { type: "password", password: "" },
};

const DEFAULT_PROFILE: Hy2ClientProfile = {
  server: "",
  auth: "",
  tls: { sni: "", insecure: false, pinSHA256: [], ca: "", clientCertificate: "", clientKey: "" },
  transport: { type: "udp" },
  fastOpen: false,
  lazy: false,
};

function normalizeSettings(input: Hy2Settings | null | undefined): Hy2Settings {
  const next = { ...DEFAULT_SETTINGS, ...(input || {}) } as Hy2Settings;
  next.listen = (next.listen || "").trim() || ":443";
  next.udpIdleTimeout = (next.udpIdleTimeout || "").trim();
  next.tlsMode = (next.tlsMode || "acme").toLowerCase();
  next.auth = { type: "password", password: "", ...(next.auth || {}) };
  next.auth.type = (next.auth.type || "password").toLowerCase();
  if (next.acme) {
    next.acme.domains = (next.acme.domains || []).map((item) => item.trim()).filter(Boolean);
    next.acme.email = (next.acme.email || "").trim();
    next.acme.type = (next.acme.type || "http").toLowerCase();
  }
  if (next.obfs?.type) next.obfs.type = next.obfs.type.toLowerCase().trim();
  if (next.resolver?.type) next.resolver.type = next.resolver.type.toLowerCase().trim();
  if (next.masquerade?.type) next.masquerade.type = next.masquerade.type.toLowerCase().trim();
  return next;
}

function normalizeProfile(input: Hy2ClientProfile | null | undefined): Hy2ClientProfile {
  const next = { ...DEFAULT_PROFILE, ...(input || {}) } as Hy2ClientProfile;
  next.name = (next.name || "").trim();
  next.server = (next.server || "").trim();
  next.auth = (next.auth || "").trim();
  next.tls = {
    ...DEFAULT_PROFILE.tls,
    ...(next.tls || {}),
    pinSHA256: (next.tls?.pinSHA256 || []).map((item) => item.trim()).filter(Boolean),
    ca: (next.tls?.ca || "").trim(),
    clientCertificate: (next.tls?.clientCertificate || "").trim(),
    clientKey: (next.tls?.clientKey || "").trim(),
  };
  next.transport = { type: (next.transport?.type || "udp").toLowerCase(), ...(next.transport || {}) };
  if (next.obfs?.type) next.obfs.type = next.obfs.type.toLowerCase().trim();
  return next;
}

function listToTextarea(items?: string[]): string {
  return (items || []).join("\n");
}

function textareaToList(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function parseUserpass(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(":");
    const user = (parts.shift() || "").trim();
    const pass = parts.join(":").trim();
    if (user) out[user] = pass;
  }
  return out;
}

function userpassToText(userpass?: Record<string, string>): string {
  if (!userpass) return "";
  return Object.entries(userpass).map(([user, pass]) => `${user}:${pass}`).join("\n");
}

function jsonToPretty(value: unknown): string {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseJSONMap(text: string): Record<string, string> {
  try {
    const parsed = JSON.parse(text || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      out[key] = typeof value === "string" ? value : String(value);
    }
    return out;
  } catch {
    return {};
  }
}

function parseOutboundsJSON(text: string): Hy2Settings["outbounds"] {
  try {
    const parsed = JSON.parse(text || "[]");
    return Array.isArray(parsed) ? (parsed as Hy2Settings["outbounds"]) : [];
  } catch {
    return [];
  }
}

function diffLineCount(source: string, target: string): number {
  const a = source.split(/\r?\n/);
  const b = target.split(/\r?\n/);
  const max = Math.max(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < max; i += 1) {
    if ((a[i] || "") !== (b[i] || "")) changed += 1;
  }
  return changed;
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

export default function HysteriaSettingsPage() {
  const { push } = useToast();

  const [path, setPath] = useState("");
  const [settings, setSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Hy2Settings>(DEFAULT_SETTINGS);
  const [rawYaml, setRawYaml] = useState("");
  const [savedRawYaml, setSavedRawYaml] = useState("");
  const [settingsValidation, setSettingsValidation] = useState<Hy2SettingsValidation | null>(null);
  const [configValidation, setConfigValidation] = useState<Hy2ConfigValidation | null>(null);
  const [clientProfile, setClientProfile] = useState<Hy2ClientProfile>(DEFAULT_PROFILE);
  const [clientArtifacts, setClientArtifacts] = useState<Hy2ClientArtifacts | null>(null);
  const [clientValidation, setClientValidation] = useState<Hy2ClientValidation | null>(null);
  const [rawOnlyPaths, setRawOnlyPaths] = useState<string[]>([]);

  const [modeTemplate, setModeTemplate] = useState("socks5");
  const [loading, setLoading] = useState(true);
  const [validatingSettings, setValidatingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [validatingYaml, setValidatingYaml] = useState(false);
  const [savingYaml, setSavingYaml] = useState(false);
  const [generatingClient, setGeneratingClient] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authUserpassText, setAuthUserpassText] = useState("");
  const [aclInlineText, setAclInlineText] = useState("");
  const [acmeDNSConfigText, setAcmeDNSConfigText] = useState("{}");
  const [masqueradeHeadersText, setMasqueradeHeadersText] = useState("{}");
  const [outboundsJSON, setOutboundsJSON] = useState("[]");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isSettingsDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);
  const yamlDiff = useMemo(() => diffLineCount(savedRawYaml, rawYaml), [savedRawYaml, rawYaml]);
  const qrCodeURL = useMemo(() => {
    const uri = clientArtifacts?.uri || "";
    if (!uri) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uri)}`;
  }, [clientArtifacts?.uri]);

  function markCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
  }

  function hydrateDerivedFields(nextSettings: Hy2Settings) {
    setAuthUserpassText(userpassToText(nextSettings.auth?.userpass));
    setAclInlineText(listToTextarea(nextSettings.acl?.inline));
    setAcmeDNSConfigText(jsonToPretty(nextSettings.acme?.dns?.config || {}));
    setMasqueradeHeadersText(jsonToPretty(nextSettings.masquerade?.string?.headers || {}));
    setOutboundsJSON(jsonToPretty(nextSettings.outbounds || []));
  }

  async function load() {
    setLoading(true);
    try {
      const payload = await apiFetch<Hy2SettingsPayload>("/api/hy2/settings");
      const normalizedSettings = normalizeSettings(payload.settings);
      const normalizedProfile = normalizeProfile(payload.client_profile);
      setPath(payload.path || "");
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setRawYaml(payload.raw_yaml || "");
      setSavedRawYaml(payload.raw_yaml || "");
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      setClientProfile(normalizedProfile);
      setClientArtifacts(payload.client_artifacts || null);
      setClientValidation(payload.client_validation || null);
      setRawOnlyPaths(payload.raw_only_paths || payload.config_validation?.rawOnlyPaths || []);
      hydrateDerivedFields(normalizedSettings);
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

  function updateSetting<K extends keyof Hy2Settings>(key: K, value: Hy2Settings[K]) {
    setSettings((prev) => normalizeSettings({ ...prev, [key]: value }));
  }

  function applyDerivedFields(base: Hy2Settings): Hy2Settings {
    const next = normalizeSettings(base);
    next.auth = { ...(next.auth || {}), userpass: parseUserpass(authUserpassText) };
    if (!next.acl) next.acl = {};
    next.acl.inline = textareaToList(aclInlineText);
    if (!next.acme) next.acme = { domains: [], email: "", type: "http" };
    if (!next.acme.dns) next.acme.dns = {};
    next.acme.dns.config = parseJSONMap(acmeDNSConfigText);
    if (!next.masquerade) next.masquerade = { type: "proxy" };
    if (!next.masquerade.string) next.masquerade.string = {};
    next.masquerade.string.headers = parseJSONMap(masqueradeHeadersText);
    next.outbounds = parseOutboundsJSON(outboundsJSON);
    return normalizeSettings(next);
  }

  async function validateSettingsAction() {
    const payloadSettings = applyDerivedFields(settings);
    setValidatingSettings(true);
    try {
      const payload = await apiFetch<{ settings: Hy2Settings; settings_validation: Hy2SettingsValidation; config_validation: Hy2ConfigValidation; raw_yaml: string; client_profile: Hy2ClientProfile; client_artifacts: Hy2ClientArtifacts; client_validation: Hy2ClientValidation }>("/api/hy2/settings/validate", {
        method: "POST",
        body: toJSONBody(payloadSettings),
      });
      const normalizedSettings = normalizeSettings(payload.settings || payloadSettings);
      setSettings(normalizedSettings);
      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      setRawYaml(payload.raw_yaml || rawYaml);
      setClientProfile(normalizeProfile(payload.client_profile));
      setClientArtifacts(payload.client_artifacts || null);
      setClientValidation(payload.client_validation || null);
      setRawOnlyPaths(payload.config_validation?.rawOnlyPaths || []);
      hydrateDerivedFields(normalizedSettings);
      setError(null);
      push(payload.settings_validation?.valid && payload.config_validation?.valid ? "Validation passed" : "Validation failed", payload.settings_validation?.valid && payload.config_validation?.valid ? "success" : "error");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      setError(message);
      push(message, "error");
    } finally {
      setValidatingSettings(false);
    }
  }

  async function saveSettingsAction() {
    const payloadSettings = applyDerivedFields(settings);
    setSavingSettings(true);
    try {
      await apiFetch<Hy2SettingsPayload>("/api/hy2/settings", { method: "PUT", body: toJSONBody(payloadSettings) });
      await load();
      push("Server settings saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
      push(message, "error");
    } finally {
      setSavingSettings(false);
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
      const payload = await apiFetch<{ validation: Hy2ConfigValidation; settings: Hy2Settings; client_profile: Hy2ClientProfile; client_artifacts: Hy2ClientArtifacts; client_validation: Hy2ClientValidation }>("/api/hy2/config/validate", {
        method: "POST",
        body: toJSONBody({ content: rawYaml }),
      });
      const normalizedSettings = normalizeSettings(payload.settings);
      setSettings(normalizedSettings);
      setConfigValidation(payload.validation || null);
      setClientProfile(normalizeProfile(payload.client_profile));
      setClientArtifacts(payload.client_artifacts || null);
      setClientValidation(payload.client_validation || null);
      setRawOnlyPaths(payload.validation?.rawOnlyPaths || []);
      hydrateDerivedFields(normalizedSettings);
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

  async function generateClientArtifactsAction() {
    setGeneratingClient(true);
    try {
      const payload = await apiFetch<{ artifacts: Hy2ClientArtifacts; validation: Hy2ClientValidation }>("/api/hy2/client/generate", {
        method: "POST",
        body: toJSONBody({ profile: normalizeProfile(clientProfile), mode_template: modeTemplate }),
      });
      setClientArtifacts(payload.artifacts || null);
      setClientValidation(payload.validation || null);
      setError(null);
      push("Client artifacts generated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate client artifacts";
      setError(message);
      push(message, "error");
    } finally {
      setGeneratingClient(false);
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
      <PageHeader title="Hysteria" description="Full Hysteria 2 server/client configuration management with structured settings, raw YAML sync and safe apply flow." />
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
          <AlertTitle>Raw-only fields detected</AlertTitle>
          <AlertDescription>This config contains fields represented only in YAML. They are preserved, but review raw YAML before apply.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="server" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="server"><Server className="size-4" />Server Settings</TabsTrigger>
          <TabsTrigger value="profile"><QrCode className="size-4" />Client Profile</TabsTrigger>
          <TabsTrigger value="yaml"><FileText className="size-4" />Full YAML Editor</TabsTrigger>
          <TabsTrigger value="generator"><Sparkles className="size-4" />Client YAML Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="server" className="space-y-4">
          <ValidationAlerts title="Server settings" validation={settingsValidation} />
          <ValidationAlerts title="Rendered config" validation={configValidation} />

          <Card>
            <CardHeader>
              <CardTitle>Network</CardTitle>
              <CardDescription>listen, UDP behavior, QUIC and bandwidth settings.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TextField label="listen" value={settings.listen} onChange={(e) => updateSetting("listen", e.target.value)} description="Example: :443" />
              <TextField label="udpIdleTimeout" value={settings.udpIdleTimeout || ""} onChange={(e) => updateSetting("udpIdleTimeout", e.target.value)} placeholder="30s" />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label>disableUDP</Label><p className="text-xs text-muted-foreground">Disable UDP relay if not needed.</p></div>
                <Switch checked={Boolean(settings.disableUDP)} onCheckedChange={(v) => updateSetting("disableUDP", v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label>ignoreClientBandwidth</Label><p className="text-xs text-muted-foreground">Ignore client-provided bandwidth values.</p></div>
                <Switch checked={Boolean(settings.ignoreClientBandwidth)} onCheckedChange={(v) => updateSetting("ignoreClientBandwidth", v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div><Label>speedTest</Label><p className="text-xs text-muted-foreground">Enable speed test endpoint.</p></div>
                <Switch checked={Boolean(settings.speedTest)} onCheckedChange={(v) => updateSetting("speedTest", v)} />
              </div>
              <TextField label="bandwidth.up" value={settings.bandwidth?.up || ""} onChange={(e) => updateSetting("bandwidth", { ...(settings.bandwidth || {}), up: e.target.value })} placeholder="100 mbps" />
              <TextField label="bandwidth.down" value={settings.bandwidth?.down || ""} onChange={(e) => updateSetting("bandwidth", { ...(settings.bandwidth || {}), down: e.target.value })} placeholder="100 mbps" />
              <TextField label="quic.initStreamReceiveWindow" value={String(settings.quic?.initStreamReceiveWindow || "")} onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), initStreamReceiveWindow: Number(e.target.value || 0) || undefined })} />
              <TextField label="quic.maxStreamReceiveWindow" value={String(settings.quic?.maxStreamReceiveWindow || "")} onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxStreamReceiveWindow: Number(e.target.value || 0) || undefined })} />
              <TextField label="quic.initConnReceiveWindow" value={String(settings.quic?.initConnReceiveWindow || "")} onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), initConnReceiveWindow: Number(e.target.value || 0) || undefined })} />
              <TextField label="quic.maxConnReceiveWindow" value={String(settings.quic?.maxConnReceiveWindow || "")} onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxConnReceiveWindow: Number(e.target.value || 0) || undefined })} />
              <TextField label="quic.maxIdleTimeout" value={settings.quic?.maxIdleTimeout || ""} onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxIdleTimeout: e.target.value })} placeholder="30s" />
              <TextField label="quic.maxIncomingStreams" value={String(settings.quic?.maxIncomingStreams || "")} onChange={(e) => updateSetting("quic", { ...(settings.quic || {}), maxIncomingStreams: Number(e.target.value || 0) || undefined })} />
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div><Label>quic.disablePathMTUDiscovery</Label><p className="text-xs text-muted-foreground">Disable QUIC PMTU discovery.</p></div>
                <Switch checked={Boolean(settings.quic?.disablePathMTUDiscovery)} onCheckedChange={(v) => updateSetting("quic", { ...(settings.quic || {}), disablePathMTUDiscovery: v })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>TLS / Certificates</CardTitle>
              <CardDescription>`tls` and `acme` are mutually exclusive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectField label="TLS mode" value={settings.tlsMode} onValueChange={(value) => updateSetting("tlsMode", value)} options={[{ value: "acme", label: "acme" }, { value: "tls", label: "tls" }]} />

              {settings.tlsMode === "tls" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="tls.cert" value={settings.tls?.cert || ""} onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), cert: e.target.value })} />
                  <TextField label="tls.key" value={settings.tls?.key || ""} onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), key: e.target.value })} />
                  <TextField label="tls.sniGuard" value={settings.tls?.sniGuard || ""} onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), sniGuard: e.target.value })} />
                  <TextField label="tls.clientCA" value={settings.tls?.clientCA || ""} onChange={(e) => updateSetting("tls", { ...(settings.tls || {}), clientCA: e.target.value })} />
                </div>
              )}

              {settings.tlsMode === "acme" && (
                <div className="space-y-4">
                  <TextField label="acme.domains" value={(settings.acme?.domains || []).join(", ")} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), domains: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} description="Comma-separated domains." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField label="acme.email" value={settings.acme?.email || ""} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), email: e.target.value })} />
                    <SelectField label="acme.type" value={settings.acme?.type || "http"} onValueChange={(value) => updateSetting("acme", { ...(settings.acme || {}), type: value })} options={[{ value: "http", label: "http" }, { value: "tls", label: "tls" }, { value: "dns", label: "dns" }]} />
                    <TextField label="acme.ca" value={settings.acme?.ca || ""} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), ca: e.target.value })} />
                    <TextField label="acme.listenHost" value={settings.acme?.listenHost || ""} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), listenHost: e.target.value })} />
                    <TextField label="acme.dir" value={settings.acme?.dir || ""} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), dir: e.target.value })} />
                    <TextField label="acme.http.altPort" value={String(settings.acme?.http?.altPort || "")} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), http: { ...(settings.acme?.http || {}), altPort: Number(e.target.value || 0) || undefined } })} />
                    <TextField label="acme.tls.altPort" value={String(settings.acme?.tls?.altPort || "")} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), tls: { ...(settings.acme?.tls || {}), altPort: Number(e.target.value || 0) || undefined } })} />
                    {(settings.acme?.type || "http") === "dns" && <TextField label="acme.dns.name" value={settings.acme?.dns?.name || ""} onChange={(e) => updateSetting("acme", { ...(settings.acme || {}), dns: { ...(settings.acme?.dns || {}), name: e.target.value } })} />}
                  </div>
                  {(settings.acme?.type || "http") === "dns" && <TextareaField label="acme.dns.config (JSON)" value={acmeDNSConfigText} onChange={(e) => setAcmeDNSConfigText(e.target.value)} className="font-mono text-xs" />}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access / Auth</CardTitle>
              <CardDescription>auth, resolver, sniff, trafficStats.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectField label="auth.type" value={settings.auth?.type || "password"} onValueChange={(value) => updateSetting("auth", { ...(settings.auth || {}), type: value })} options={[{ value: "password", label: "password" }, { value: "userpass", label: "userpass" }, { value: "http", label: "http" }, { value: "command", label: "command" }]} />
              {settings.auth?.type === "password" && <TextField label="auth.password" value={settings.auth?.password || ""} onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), password: e.target.value })} />}
              {settings.auth?.type === "userpass" && <TextareaField label="auth.userpass" value={authUserpassText} onChange={(e) => setAuthUserpassText(e.target.value)} description="username:password per line" className="font-mono text-xs" />}
              {settings.auth?.type === "http" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="auth.http.url" value={settings.auth?.http?.url || ""} onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), http: { ...(settings.auth?.http || {}), url: e.target.value } })} />
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><Label>auth.http.insecure</Label><p className="text-xs text-muted-foreground">Allow insecure TLS for auth endpoint.</p></div>
                    <Switch checked={Boolean(settings.auth?.http?.insecure)} onCheckedChange={(v) => updateSetting("auth", { ...(settings.auth || {}), http: { ...(settings.auth?.http || {}), insecure: v } })} />
                  </div>
                </div>
              )}
              {settings.auth?.type === "command" && <TextField label="auth.command" value={settings.auth?.command || ""} onChange={(e) => updateSetting("auth", { ...(settings.auth || {}), command: e.target.value })} />}

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="resolver.type" value={settings.resolver?.type || ""} onValueChange={(value) => updateSetting("resolver", value ? { ...(settings.resolver || {}), type: value } : undefined)} options={[{ value: "tcp", label: "tcp" }, { value: "udp", label: "udp" }, { value: "tls", label: "tls" }, { value: "https", label: "https" }]} />

                {settings.resolver?.type === "tcp" && (
                  <>
                    <TextField label="resolver.tcp.addr" value={settings.resolver?.tcp?.addr || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "tcp", tcp: { ...(settings.resolver?.tcp || {}), addr: e.target.value } })} />
                    <TextField label="resolver.tcp.timeout" value={settings.resolver?.tcp?.timeout || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "tcp", tcp: { ...(settings.resolver?.tcp || {}), timeout: e.target.value } })} />
                  </>
                )}
                {settings.resolver?.type === "udp" && (
                  <>
                    <TextField label="resolver.udp.addr" value={settings.resolver?.udp?.addr || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "udp", udp: { ...(settings.resolver?.udp || {}), addr: e.target.value } })} />
                    <TextField label="resolver.udp.timeout" value={settings.resolver?.udp?.timeout || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "udp", udp: { ...(settings.resolver?.udp || {}), timeout: e.target.value } })} />
                  </>
                )}
                {settings.resolver?.type === "tls" && (
                  <>
                    <TextField label="resolver.tls.addr" value={settings.resolver?.tls?.addr || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "tls", tls: { ...(settings.resolver?.tls || {}), addr: e.target.value } })} />
                    <TextField label="resolver.tls.timeout" value={settings.resolver?.tls?.timeout || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "tls", tls: { ...(settings.resolver?.tls || {}), timeout: e.target.value } })} />
                    <TextField label="resolver.tls.sni" value={settings.resolver?.tls?.sni || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "tls", tls: { ...(settings.resolver?.tls || {}), sni: e.target.value } })} />
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div><Label>resolver.tls.insecure</Label><p className="text-xs text-muted-foreground">Allow insecure TLS for resolver endpoint.</p></div>
                      <Switch checked={Boolean(settings.resolver?.tls?.insecure)} onCheckedChange={(v) => updateSetting("resolver", { ...(settings.resolver || {}), type: "tls", tls: { ...(settings.resolver?.tls || {}), insecure: v } })} />
                    </div>
                  </>
                )}
                {settings.resolver?.type === "https" && (
                  <>
                    <TextField label="resolver.https.addr" value={settings.resolver?.https?.addr || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "https", https: { ...(settings.resolver?.https || {}), addr: e.target.value } })} />
                    <TextField label="resolver.https.timeout" value={settings.resolver?.https?.timeout || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "https", https: { ...(settings.resolver?.https || {}), timeout: e.target.value } })} />
                    <TextField label="resolver.https.sni" value={settings.resolver?.https?.sni || ""} onChange={(e) => updateSetting("resolver", { ...(settings.resolver || {}), type: "https", https: { ...(settings.resolver?.https || {}), sni: e.target.value } })} />
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div><Label>resolver.https.insecure</Label><p className="text-xs text-muted-foreground">Allow insecure TLS for resolver endpoint.</p></div>
                      <Switch checked={Boolean(settings.resolver?.https?.insecure)} onCheckedChange={(v) => updateSetting("resolver", { ...(settings.resolver || {}), type: "https", https: { ...(settings.resolver?.https || {}), insecure: v } })} />
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><Label>sniff.enable</Label><p className="text-xs text-muted-foreground">Enable protocol/domain sniffing.</p></div>
                  <Switch checked={Boolean(settings.sniff?.enable)} onCheckedChange={(v) => updateSetting("sniff", { ...(settings.sniff || {}), enable: v })} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><Label>sniff.rewriteDomain</Label><p className="text-xs text-muted-foreground">Rewrite domain based on sniff result.</p></div>
                  <Switch checked={Boolean(settings.sniff?.rewriteDomain)} onCheckedChange={(v) => updateSetting("sniff", { ...(settings.sniff || {}), rewriteDomain: v })} />
                </div>
                <TextField label="sniff.timeout" value={settings.sniff?.timeout || ""} onChange={(e) => updateSetting("sniff", { ...(settings.sniff || {}), timeout: e.target.value })} />
                <TextField label="sniff.tcpPorts" value={settings.sniff?.tcpPorts || ""} onChange={(e) => updateSetting("sniff", { ...(settings.sniff || {}), tcpPorts: e.target.value })} description="Use port list or 'all'." />
                <TextField label="sniff.udpPorts" value={settings.sniff?.udpPorts || ""} onChange={(e) => updateSetting("sniff", { ...(settings.sniff || {}), udpPorts: e.target.value })} description="Use port list or 'all'." />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="trafficStats.listen" value={settings.trafficStats?.listen || ""} onChange={(e) => updateSetting("trafficStats", { ...(settings.trafficStats || {}), listen: e.target.value })} />
                <TextField label="trafficStats.secret" value={settings.trafficStats?.secret || ""} onChange={(e) => updateSetting("trafficStats", { ...(settings.trafficStats || {}), secret: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traffic / Routing</CardTitle>
              <CardDescription>ACL rules and outbounds list.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TextField label="acl.file" value={settings.acl?.file || ""} onChange={(e) => updateSetting("acl", { ...(settings.acl || {}), file: e.target.value })} />
              <TextField label="acl.geoUpdateInterval" value={settings.acl?.geoUpdateInterval || ""} onChange={(e) => updateSetting("acl", { ...(settings.acl || {}), geoUpdateInterval: e.target.value })} />
              <TextField label="acl.geoip" value={settings.acl?.geoip || ""} onChange={(e) => updateSetting("acl", { ...(settings.acl || {}), geoip: e.target.value })} />
              <TextField label="acl.geosite" value={settings.acl?.geosite || ""} onChange={(e) => updateSetting("acl", { ...(settings.acl || {}), geosite: e.target.value })} />
              <TextareaField label="acl.inline" value={aclInlineText} onChange={(e) => setAclInlineText(e.target.value)} className="md:col-span-2 font-mono text-xs" />
              <TextareaField label="outbounds (JSON)" value={outboundsJSON} onChange={(e) => setOutboundsJSON(e.target.value)} className="md:col-span-2 font-mono text-xs" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Camouflage / Evasion</CardTitle>
              <CardDescription>obfs and masquerade selectors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectField label="obfs.type" value={settings.obfs?.type || ""} onValueChange={(value) => updateSetting("obfs", value ? { ...(settings.obfs || {}), type: value } : undefined)} options={[{ value: "salamander", label: "salamander" }]} />
              {settings.obfs?.type === "salamander" && <TextField label="obfs.salamander.password" value={settings.obfs?.salamander?.password || ""} onChange={(e) => updateSetting("obfs", { ...(settings.obfs || {}), type: "salamander", salamander: { ...(settings.obfs?.salamander || {}), password: e.target.value } })} />}

              <SelectField label="masquerade.type" value={settings.masquerade?.type || ""} onValueChange={(value) => updateSetting("masquerade", value ? { ...(settings.masquerade || {}), type: value } : undefined)} options={[{ value: "proxy", label: "proxy" }, { value: "file", label: "file" }, { value: "string", label: "string" }]} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="masquerade.listenHTTP" value={settings.masquerade?.listenHTTP || ""} onChange={(e) => updateSetting("masquerade", { ...(settings.masquerade || {}), listenHTTP: e.target.value })} />
                <TextField label="masquerade.listenHTTPS" value={settings.masquerade?.listenHTTPS || ""} onChange={(e) => updateSetting("masquerade", { ...(settings.masquerade || {}), listenHTTPS: e.target.value })} />
                <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                  <div><Label>masquerade.forceHTTPS</Label><p className="text-xs text-muted-foreground">Redirect plaintext HTTP to HTTPS listener.</p></div>
                  <Switch checked={Boolean(settings.masquerade?.forceHTTPS)} onCheckedChange={(v) => updateSetting("masquerade", { ...(settings.masquerade || {}), forceHTTPS: v })} />
                </div>
              </div>
              {settings.masquerade?.type === "proxy" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="masquerade.proxy.url" value={settings.masquerade?.proxy?.url || ""} onChange={(e) => updateSetting("masquerade", { ...(settings.masquerade || {}), type: "proxy", proxy: { ...(settings.masquerade?.proxy || {}), url: e.target.value } })} />
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><Label>masquerade.proxy.rewriteHost</Label><p className="text-xs text-muted-foreground">Rewrite Host header to target.</p></div>
                    <Switch checked={Boolean(settings.masquerade?.proxy?.rewriteHost)} onCheckedChange={(v) => updateSetting("masquerade", { ...(settings.masquerade || {}), type: "proxy", proxy: { ...(settings.masquerade?.proxy || {}), rewriteHost: v } })} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><Label>masquerade.proxy.insecure</Label><p className="text-xs text-muted-foreground">Allow insecure TLS to target proxy.</p></div>
                    <Switch checked={Boolean(settings.masquerade?.proxy?.insecure)} onCheckedChange={(v) => updateSetting("masquerade", { ...(settings.masquerade || {}), type: "proxy", proxy: { ...(settings.masquerade?.proxy || {}), insecure: v } })} />
                  </div>
                </div>
              )}
              {settings.masquerade?.type === "file" && <TextField label="masquerade.file.dir" value={settings.masquerade?.file?.dir || ""} onChange={(e) => updateSetting("masquerade", { ...(settings.masquerade || {}), type: "file", file: { ...(settings.masquerade?.file || {}), dir: e.target.value } })} />}
              {settings.masquerade?.type === "string" && <>
                <TextField label="masquerade.string.content" value={settings.masquerade?.string?.content || ""} onChange={(e) => updateSetting("masquerade", { ...(settings.masquerade || {}), type: "string", string: { ...(settings.masquerade?.string || {}), content: e.target.value } })} />
                <TextField label="masquerade.string.statusCode" value={String(settings.masquerade?.string?.statusCode || "")} onChange={(e) => updateSetting("masquerade", { ...(settings.masquerade || {}), type: "string", string: { ...(settings.masquerade?.string || {}), statusCode: Number(e.target.value || 0) || undefined } })} />
                <TextareaField label="masquerade.string.headers (JSON)" value={masqueradeHeadersText} onChange={(e) => setMasqueradeHeadersText(e.target.value)} className="font-mono text-xs" />
              </>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void validateSettingsAction()} disabled={validatingSettings || loading}><SearchCheck className="size-4" />{validatingSettings ? "Validating..." : "Validate settings"}</Button>
              <Button onClick={() => void saveSettingsAction()} disabled={savingSettings || loading || (!isSettingsDirty && settingsValidation?.valid)}><Save className="size-4" />{savingSettings ? "Saving..." : "Save settings"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <ValidationAlerts title="Client profile" validation={clientValidation} />
          <Card>
            <CardHeader><CardTitle>Connection / Performance</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TextField label="name" value={clientProfile.name || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, name: e.target.value }))} />
              <TextField label="server" value={clientProfile.server} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, server: e.target.value }))} description="Example: example.com:443,8443-8450 for port hopping." />
              <TextField label="auth" value={clientProfile.auth} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, auth: e.target.value }))} />
              <TextField label="tls.sni" value={clientProfile.tls?.sni || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, tls: { ...(prev.tls || {}), sni: e.target.value } }))} />
              <TextField label="tls.ca" value={clientProfile.tls?.ca || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, tls: { ...(prev.tls || {}), ca: e.target.value } }))} />
              <TextField label="tls.clientCertificate" value={clientProfile.tls?.clientCertificate || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, tls: { ...(prev.tls || {}), clientCertificate: e.target.value } }))} />
              <TextField label="tls.clientKey" value={clientProfile.tls?.clientKey || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, tls: { ...(prev.tls || {}), clientKey: e.target.value } }))} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label>tls.insecure</Label><p className="text-xs text-muted-foreground">Disable certificate verification.</p></div>
                <Switch checked={Boolean(clientProfile.tls?.insecure)} onCheckedChange={(v) => setClientProfile((prev) => normalizeProfile({ ...prev, tls: { ...(prev.tls || {}), insecure: v } }))} />
              </div>
              <TextareaField label="tls.pinSHA256" value={(clientProfile.tls?.pinSHA256 || []).join("\n")} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, tls: { ...(prev.tls || {}), pinSHA256: textareaToList(e.target.value) } }))} description="One fingerprint per line." className="md:col-span-2 font-mono text-xs" />
              <SelectField label="obfs.type" value={clientProfile.obfs?.type || ""} onValueChange={(value) => setClientProfile((prev) => normalizeProfile({ ...prev, obfs: value ? { ...(prev.obfs || {}), type: value } : undefined }))} options={[{ value: "salamander", label: "salamander" }]} />
              {clientProfile.obfs?.type === "salamander" && (
                <TextField
                  label="obfs.salamander.password"
                  value={clientProfile.obfs?.salamander?.password || ""}
                  onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, obfs: { ...(prev.obfs || {}), type: "salamander", salamander: { ...(prev.obfs?.salamander || {}), password: e.target.value } } }))}
                />
              )}
              <TextField label="transport.udp.hopInterval" value={clientProfile.transport?.udp?.hopInterval || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, transport: { ...(prev.transport || {}), type: "udp", udp: { ...(prev.transport?.udp || {}), hopInterval: e.target.value } } }))} placeholder="10s" />
              <TextField label="quic.maxIdleTimeout" value={clientProfile.quic?.maxIdleTimeout || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, quic: { ...(prev.quic || {}), maxIdleTimeout: e.target.value } }))} />
              <TextField label="quic.keepAlivePeriod" value={clientProfile.quic?.keepAlivePeriod || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, quic: { ...(prev.quic || {}), keepAlivePeriod: e.target.value } }))} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label>quic.disablePathMTUDiscovery</Label><p className="text-xs text-muted-foreground">Disable QUIC PMTU discovery.</p></div>
                <Switch checked={Boolean(clientProfile.quic?.disablePathMTUDiscovery)} onCheckedChange={(v) => setClientProfile((prev) => normalizeProfile({ ...prev, quic: { ...(prev.quic || {}), disablePathMTUDiscovery: v } }))} />
              </div>
              <TextField label="bandwidth.up" value={clientProfile.bandwidth?.up || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, bandwidth: { ...(prev.bandwidth || {}), up: e.target.value } }))} />
              <TextField label="bandwidth.down" value={clientProfile.bandwidth?.down || ""} onChange={(e) => setClientProfile((prev) => normalizeProfile({ ...prev, bandwidth: { ...(prev.bandwidth || {}), down: e.target.value } }))} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label>fastOpen</Label><p className="text-xs text-muted-foreground">Enable TCP Fast Open on supported systems.</p></div>
                <Switch checked={Boolean(clientProfile.fastOpen)} onCheckedChange={(v) => setClientProfile((prev) => normalizeProfile({ ...prev, fastOpen: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label>lazy</Label><p className="text-xs text-muted-foreground">Delay outbound connection until first packet.</p></div>
                <Switch checked={Boolean(clientProfile.lazy)} onCheckedChange={(v) => setClientProfile((prev) => normalizeProfile({ ...prev, lazy: v }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Output</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <SelectField label="Mode template" value={modeTemplate} onValueChange={setModeTemplate} options={[{ value: "socks5", label: "socks5" }, { value: "http", label: "http" }, { value: "tun", label: "tun" }, { value: "tcpForwarding", label: "tcpForwarding" }, { value: "udpForwarding", label: "udpForwarding" }, { value: "tcpTProxy", label: "tcpTProxy" }, { value: "udpTProxy", label: "udpTProxy" }, { value: "tcpRedirect", label: "tcpRedirect" }]} />
                <div className="flex items-end"><Button onClick={() => void generateClientArtifactsAction()} disabled={generatingClient}><Sparkles className="size-4" />{generatingClient ? "Generating..." : "Generate"}</Button></div>
              </div>
              <TextareaField label="URI" value={clientArtifacts?.uri || ""} readOnly className="font-mono text-xs" />
              {qrCodeURL ? (
                <div className="rounded-lg border p-3">
                  <Label>QR</Label>
                  <img src={qrCodeURL} alt="Hysteria 2 URI QR" className="mt-2 h-56 w-56 rounded-md border bg-white p-2" />
                </div>
              ) : null}
              <TextareaField label="client.yaml" value={clientArtifacts?.clientYAML || ""} readOnly className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyValue(clientArtifacts?.uri || "", "uri")}>{copiedKey === "uri" ? "Copied" : "Copy URI"}</Button>
                <Button variant="outline" size="sm" onClick={() => void copyValue(clientArtifacts?.uriHy2 || "", "uri-hy2")}>{copiedKey === "uri-hy2" ? "Copied" : "Copy hy2://"}</Button>
                <Button variant="outline" size="sm" onClick={() => void copyValue(clientArtifacts?.clientYAML || "", "client-yaml")}>{copiedKey === "client-yaml" ? "Copied" : "Copy client YAML"}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yaml" className="space-y-4">
          <ValidationAlerts title="YAML validation" validation={configValidation} />
          <Card>
            <CardHeader><CardTitle>Full YAML Editor</CardTitle><CardDescription>Path: {path || "-"}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <TextareaField label="server.yaml" value={rawYaml} onChange={(e) => setRawYaml(e.target.value)} className="min-h-[420px] font-mono text-xs" />
              <div className="text-xs text-muted-foreground">Changed lines: {yamlDiff}</div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void validateRawYAMLAction()} disabled={validatingYaml || loading}><SearchCheck className="size-4" />{validatingYaml ? "Validating..." : "Validate YAML"}</Button>
                <Button onClick={() => void saveRawYAMLAction()} disabled={savingYaml || loading}><Save className="size-4" />{savingYaml ? "Saving..." : "Save YAML"}</Button>
                <Button variant="secondary" onClick={() => setApplyConfirmOpen(true)} disabled={applying || loading}><PlayCircle className="size-4" />Apply config</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generator" className="space-y-4">
          <ValidationAlerts title="Client generation" validation={clientValidation} />
          <Card>
            <CardHeader><CardTitle>Client YAML Generator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <TextareaField label="client.yaml" value={clientArtifacts?.clientYAML || ""} readOnly className="min-h-[360px] font-mono text-xs" />
              <Button variant="outline" onClick={() => void copyValue(clientArtifacts?.clientYAML || "", "generator-yaml")}><Copy className="size-4" />{copiedKey === "generator-yaml" ? "Copied" : "Copy"}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={applyConfirmOpen} title="Apply Hysteria config" description="Restart hysteria-server with current saved config?" confirmLabel="Apply" onClose={() => setApplyConfirmOpen(false)} onConfirm={applySettingsAction} busy={applying} />

      {loading && (
        <Alert>
          <AlertTitle>Loading</AlertTitle>
          <AlertDescription>Fetching current Hysteria configuration...</AlertDescription>
        </Alert>
      )}
    </div>
  );
}












