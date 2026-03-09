"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import type { Hy2ConfigValidation, Hy2Settings, Hy2SettingsPayload, Hy2SettingsValidation } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { useToast } from "@/components/toast-provider";

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
      setSettings(payload.settings || EMPTY_SETTINGS);
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
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function validateSettings() {
    setValidating(true);
    try {
      const payload = await apiFetch<ValidatePayload>("/api/hy2/settings/validate", {
        method: "POST",
        body: toJSONBody(settings),
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
      const payload = await apiFetch<Hy2SettingsPayload>("/api/hy2/settings", {
        method: "PUT",
        body: toJSONBody(settings),
      });
      setPath(payload.path || "");
      setSettings(payload.settings || settings);
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
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hysteria 2 Settings</h1>
          <p className="page-subtitle">Native runtime settings: PORT, SNI, OBFS and Masquerade.</p>
        </div>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <Card title="Runtime source" subtitle={path || "-"}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Port</span>
            <input
              className="input"
              type="number"
              min={1}
              max={65535}
              value={settings.port}
              onChange={(event) => update("port", Number(event.target.value || 0))}
              disabled={loading}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">SNI</span>
            <input className="input" value={settings.sni} onChange={(event) => update("sni", event.target.value)} disabled={loading} />
          </label>
        </div>
      </Card>

      <Card title="OBFS" subtitle="Optional transport obfuscation.">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.obfs_enabled}
              onChange={(event) => update("obfs_enabled", event.target.checked)}
              disabled={loading}
            />
            Enable OBFS
          </label>

          {settings.obfs_enabled && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">OBFS type</span>
                <select className="input" value={settings.obfs_type || "salamander"} onChange={(event) => update("obfs_type", event.target.value)}>
                  <option value="salamander">salamander</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-muted">OBFS password</span>
                <input
                  className="input"
                  value={settings.obfs_password || ""}
                  onChange={(event) => update("obfs_password", event.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </Card>

      <Card title="Masquerade" subtitle="Proxy mode URL camouflage.">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.masquerade_enabled}
              onChange={(event) => update("masquerade_enabled", event.target.checked)}
              disabled={loading}
            />
            Enable Masquerade
          </label>

          {settings.masquerade_enabled && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Masquerade URL</span>
                <input
                  className="input"
                  value={settings.masquerade_url || ""}
                  onChange={(event) => update("masquerade_url", event.target.value)}
                  placeholder="https://www.cloudflare.com"
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.masquerade_rewrite_host}
                  onChange={(event) => update("masquerade_rewrite_host", event.target.checked)}
                />
                rewriteHost
              </label>
            </>
          )}
        </div>
      </Card>

      <Card
        title="Apply Flow"
        subtitle="Validate -> Save -> Apply"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" type="button" onClick={validateSettings} disabled={validating || loading}>
              {validating ? "Validating..." : "Validate"}
            </button>
            <button className="btn btn-primary" type="button" onClick={saveSettings} disabled={saving || !canSave || loading}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="btn btn-danger" type="button" onClick={() => setApplyConfirmOpen(true)} disabled={applying || loading}>
              {applying ? "Applying..." : "Apply / Restart"}
            </button>
          </div>
        }
      >
        {settingsValidation && settingsValidation.errors.length > 0 && (
          <div className="alert alert-error mb-3">
            {settingsValidation.errors.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        )}

        {settingsValidation && settingsValidation.warnings.length > 0 && (
          <div className="alert alert-warn mb-3">
            {settingsValidation.warnings.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        )}

        {configValidation && configValidation.errors.length > 0 && (
          <div className="alert alert-error mb-3">
            {configValidation.errors.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        )}

        <div className="grid gap-2 text-sm text-muted md:grid-cols-2">
          <div>Validation status: {settingsValidation?.valid ? "OK" : "Check fields"}</div>
          <div>Config status: {configValidation?.valid ? "OK" : "Check config"}</div>
          <div>Updated: {formatDate(new Date().toISOString())}</div>
          <div>Client port: {clientParams?.port || "-"}</div>
          <div>Client SNI: {clientParams?.sni || "-"}</div>
          <div>Client OBFS: {clientParams?.obfs_type || "disabled"}</div>
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
