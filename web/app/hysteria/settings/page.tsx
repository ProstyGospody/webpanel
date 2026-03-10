"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  OctagonAlert,
  PlayCircle,
  Save,
  SearchCheck,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsPayload, Hy2SettingsValidation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { SelectField, TextField } from "@/components/app/fields";
import { ConfirmDialog } from "@/components/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ValidatePayload = {
  settings_validation: Hy2SettingsValidation;
  config_validation: Hy2ConfigValidation;
  client_params: Hy2SettingsPayload["client_params"] | null;
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
const MODE_CONFLICT_ERROR = "Current config has both OBFS and Masquerade enabled. Choose one mode and save.";

const tabs = [
  { href: "/hysteria/users", label: "Users", icon: Users },
  { href: "/hysteria/settings", label: "Settings", icon: Settings },
];

type TransportMode = "none" | "obfs" | "masquerade";

const MODE_OPTIONS: Array<{ value: TransportMode; title: string; description: string }> = [
  {
    value: "none",
    title: "None",
    description: "No extra obfuscation layer. Use direct Hysteria transport.",
  },
  {
    value: "obfs",
    title: "OBFS",
    description: "Enable salamander obfuscation with a shared password for compatible clients.",
  },
  {
    value: "masquerade",
    title: "Masquerade",
    description: "Proxy camouflage mode with an upstream URL and optional host rewrite.",
  },
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

function normalizeDraft(input: Hy2Settings): Hy2Settings {
  return {
    ...input,
    port: Number(input.port || 0),
    sni: (input.sni || "").trim(),
    obfs_type: (input.obfs_type || "").trim().toLowerCase(),
    obfs_password: (input.obfs_password || "").trim(),
    masquerade_type: (input.masquerade_type || "").trim().toLowerCase(),
    masquerade_url: (input.masquerade_url || "").trim(),
    masquerade_rewrite_host: Boolean(input.masquerade_rewrite_host),
  };
}

function detectMode(settings: Hy2Settings): TransportMode | null {
  if (settings.obfs_enabled && settings.masquerade_enabled) {
    return null;
  }

  if (settings.obfs_enabled) {
    return "obfs";
  }

  if (settings.masquerade_enabled) {
    return "masquerade";
  }

  return "none";
}

function applyModeToSettings(input: Hy2Settings, mode: TransportMode): Hy2Settings {
  const next = normalizeDraft(input);

  next.obfs_enabled = mode === "obfs";
  next.masquerade_enabled = mode === "masquerade";

  if (next.obfs_enabled) {
    if (!next.obfs_type) {
      next.obfs_type = DEFAULT_OBFS_TYPE;
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
    next.masquerade_rewrite_host = true;
  }

  return next;
}

function sameSettings(left: Hy2Settings, right: Hy2Settings): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function HysteriaSettingsPage() {
  const { push } = useToast();

  const [path, setPath] = useState("");
  const [settings, setSettings] = useState<Hy2Settings>(EMPTY_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Hy2Settings | null>(null);
  const [mode, setMode] = useState<TransportMode | null>("none");
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
      const loadedSettings = normalizeDraft(payload.settings || EMPTY_SETTINGS);

      setPath(payload.path || "");
      setSettings(loadedSettings);
      setSavedSettings(loadedSettings);
      setMode(detectMode(loadedSettings));
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

  const modeConflict = mode === null;

  const draftSettings = useMemo(() => {
    if (!mode) {
      return null;
    }
    return applyModeToSettings(settings, mode);
  }, [mode, settings]);

  const isDirty = useMemo(() => {
    if (!draftSettings || !savedSettings) {
      return false;
    }
    return !sameSettings(draftSettings, savedSettings);
  }, [draftSettings, savedSettings]);

  const canApply = useMemo(() => {
    if (modeConflict || isDirty || loading) {
      return false;
    }

    if (settingsValidation && !settingsValidation.valid) {
      return false;
    }

    if (configValidation && !configValidation.valid) {
      return false;
    }

    return true;
  }, [configValidation, isDirty, loading, modeConflict, settingsValidation]);

  function update<K extends keyof Hy2Settings>(key: K, value: Hy2Settings[K]) {
    setSettings((prev) => normalizeDraft({ ...prev, [key]: value }));
  }

  function updateMode(nextMode: TransportMode) {
    setMode(nextMode);
    setSettings((prev) => {
      const draft = normalizeDraft(prev);
      if (nextMode === "obfs" && !draft.obfs_password) {
        draft.obfs_password = generateObfsPassword();
      }
      return draft;
    });
  }

  function requireDraftSettings(): Hy2Settings | null {
    if (modeConflict || !draftSettings) {
      setError(MODE_CONFLICT_ERROR);
      push(MODE_CONFLICT_ERROR, "error");
      return null;
    }

    return draftSettings;
  }

  async function validateSettings() {
    const payloadSettings = requireDraftSettings();
    if (!payloadSettings) {
      return;
    }

    setValidating(true);
    try {
      const payload = await apiFetch<ValidatePayload>("/api/hy2/settings/validate", {
        method: "POST",
        body: toJSONBody(payloadSettings),
      });

      setSettingsValidation(payload.settings_validation || null);
      setConfigValidation(payload.config_validation || null);
      if (payload.client_params) {
        setClientParams(payload.client_params);
      }

      setError(null);
      const valid = payload.settings_validation?.valid && payload.config_validation?.valid;
      push(valid ? "Validation passed" : "Validation failed", valid ? "success" : "error");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      setError(message);
      push(message, "error");
    } finally {
      setValidating(false);
    }
  }

  async function saveSettings() {
    const payloadSettings = requireDraftSettings();
    if (!payloadSettings) {
      return;
    }

    setSaving(true);
    try {
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

  async function applySettings() {
    if (!canApply) {
      const message = isDirty
        ? "Save changes before apply/restart."
        : "Resolve validation issues before apply/restart.";
      setError(message);
      push(message, "error");
      return;
    }

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
  const configWarnings = configValidation?.warnings || [];

  const modeLabel = mode
    ? mode === "none"
      ? "None"
      : mode === "obfs"
        ? "OBFS"
        : "Masquerade"
    : "Conflict";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hysteria"
        description="Configure ingress and transport camouflage with an explicit mode model, validation, and safe apply flow."
      />

      <SectionNav items={tabs} />

      {modeConflict && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Invalid saved mode state</AlertTitle>
          <AlertDescription>{MODE_CONFLICT_ERROR}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Runtime source</CardTitle>
          <CardDescription>Current saved configuration file and resolved runtime client parameters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StateChip title="Config path" value={path || "-"} tone="neutral" />
          <StateChip title="Client server" value={clientParams?.server || "-"} tone="neutral" />
          <StateChip title="Client port" value={String(clientParams?.port || "-")} tone="neutral" />
          <StateChip title="Client SNI" value={clientParams?.sni || "-"} tone="neutral" />
          <StateChip title="Client OBFS" value={clientParams?.obfs_type || "disabled"} tone="neutral" />
          <StateChip
            title="Validation"
            value={settingsValidation?.valid && configValidation?.valid ? "Ready" : "Needs review"}
            tone={settingsValidation?.valid && configValidation?.valid ? "success" : "warning"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection settings</CardTitle>
          <CardDescription>Core Hysteria listen settings that are always active.</CardDescription>
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
          <CardTitle>Transport mode</CardTitle>
          <CardDescription>Choose one explicit mode. OBFS and Masquerade are mutually exclusive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div role="radiogroup" aria-label="Transport mode" className="grid gap-3 md:grid-cols-3">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                disabled={loading}
                onClick={() => updateMode(option.value)}
                className={cn(
                  "rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  mode === option.value && "border-primary bg-primary/5"
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{option.title}</span>
                  {mode === option.value && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>

          {mode === "none" && (
            <Alert>
              <AlertTitle>No transport camouflage</AlertTitle>
              <AlertDescription>Hysteria will run without OBFS and without Masquerade blocks in the config.</AlertDescription>
            </Alert>
          )}

          {mode === "obfs" && (
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="OBFS type"
                value={settings.obfs_type || "salamander"}
                disabled={loading}
                description="Current backend supports salamander mode."
                onValueChange={(value) => update("obfs_type", value)}
                options={[{ value: "salamander", label: "salamander" }]}
              />

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="obfs-password">OBFS password</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => update("obfs_password", generateObfsPassword())}
                    disabled={loading}
                  >
                    <Sparkles className="size-4" />
                    Generate
                  </Button>
                </div>
                <Input
                  id="obfs-password"
                  value={settings.obfs_password || ""}
                  onChange={(event) => update("obfs_password", event.target.value)}
                  disabled={loading}
                  placeholder="Required in OBFS mode"
                />
                <p className="text-xs text-muted-foreground">This password must match the client-side OBFS password.</p>
              </div>
            </div>
          )}

          {mode === "masquerade" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Masquerade type"
                  value={settings.masquerade_type || "proxy"}
                  disabled={loading}
                  description="Proxy mode is required by backend validation."
                  onValueChange={(value) => update("masquerade_type", value)}
                  options={[{ value: "proxy", label: "proxy" }]}
                />

                <TextField
                  label="Masquerade URL"
                  value={settings.masquerade_url || ""}
                  onChange={(event) => update("masquerade_url", event.target.value)}
                  disabled={loading}
                  placeholder="https://www.cloudflare.com"
                  description="Absolute http/https URL used as camouflage upstream."
                />
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="masquerade-rewrite-host">Rewrite host header</Label>
                    <p className="text-xs text-muted-foreground">
                      Rewrites upstream host header while Masquerade mode is active.
                    </p>
                  </div>
                  <Switch
                    id="masquerade-rewrite-host"
                    checked={Boolean(settings.masquerade_rewrite_host)}
                    onCheckedChange={(value) => update("masquerade_rewrite_host", value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Validation, save, and apply</CardTitle>
            <CardDescription>
              Validate draft settings, save them to config, then apply/restart from the saved state.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" type="button" onClick={validateSettings} disabled={validating || loading || modeConflict}>
              <SearchCheck className="size-4" />
              {validating ? "Validating..." : "Validate"}
            </Button>
            <Button type="button" onClick={saveSettings} disabled={saving || loading || modeConflict || !draftSettings}>
              <Save className="size-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="destructive" type="button" onClick={() => setApplyConfirmOpen(true)} disabled={applying || !canApply}>
              <PlayCircle className="size-4" />
              {applying ? "Applying..." : "Apply / Restart"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {isDirty ? "There are unsaved changes. Save before apply/restart." : "Apply/restart uses the last saved config file."}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <StateChip title="Draft mode" value={modeLabel} tone={modeConflict ? "warning" : "neutral"} />
            <StateChip title="Draft port" value={String(draftSettings?.port || "-")} tone="neutral" />
            <StateChip title="Draft SNI" value={draftSettings?.sni || "-"} tone="neutral" />
            <StateChip title="Draft OBFS" value={draftSettings?.obfs_enabled ? draftSettings.obfs_type || "enabled" : "disabled"} tone="neutral" />
            <StateChip
              title="Draft Masquerade"
              value={draftSettings?.masquerade_enabled ? draftSettings.masquerade_url || "enabled" : "disabled"}
              tone="neutral"
            />
            <StateChip title="Draft rewriteHost" value={String(draftSettings?.masquerade_rewrite_host ?? "-")} tone="neutral" />
          </div>

          {settingsIssues.length > 0 && (
            <Alert variant="destructive">
              <OctagonAlert className="size-4" />
              <AlertTitle>Settings validation errors</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5">
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
                <ul className="list-disc space-y-1 pl-5">
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
                <ul className="list-disc space-y-1 pl-5">
                  {configIssues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {configWarnings.length > 0 && (
            <Alert>
              <AlertTitle>Generated config warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5">
                  {configWarnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={applyConfirmOpen}
        title="Apply and restart Hysteria"
        description="The currently saved config will be applied and hysteria-server will restart. Continue?"
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

