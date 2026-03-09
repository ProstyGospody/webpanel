"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { MTProxySettingsPayload } from "@/lib/types";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

type MTOverview = {
  enabled_secrets: number;
  connections_total?: number | null;
  users_total?: number | null;
};

type ServiceDetails = {
  name: string;
  status_text: string;
  checked_at: string;
};

export default function MTProxySettingsPage() {
  const { push } = useToast();

  const [settings, setSettings] = useState<MTProxySettingsPayload | null>(null);
  const [overview, setOverview] = useState<MTOverview | null>(null);
  const [service, setService] = useState<ServiceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<MTProxySettingsPayload>("/api/mtproxy/settings"),
      apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
      apiFetch<ServiceDetails>("/api/services/mtproxy?lines=1"),
    ])
      .then(([settingsPayload, overviewPayload, servicePayload]) => {
        setSettings(settingsPayload);
        setOverview(overviewPayload);
        setService(servicePayload);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load MTProxy settings";
        setError(message);
        push(message, "error");
      });
  }, [push]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">MTProxy Settings</h1>
          <p className="page-subtitle">Runtime context and service state for MTProxy.</p>
        </div>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <Card title="Runtime" subtitle="Read-only runtime values from backend config.">
        <div className="grid gap-2 text-sm text-muted md:grid-cols-2">
          <div>Public host: {settings?.public_host || "-"}</div>
          <div>Port: {settings?.port || "-"}</div>
          <div>TLS domain: {settings?.tls_domain || "-"}</div>
          <div>Stats URL: {settings?.stats_url || "-"}</div>
          <div>Stats token configured: {settings?.stats_token_config ? "yes" : "no"}</div>
          <div>Active runtime secret: {settings?.runtime_secret_id || "-"}</div>
        </div>
      </Card>

      <Card title="Live Overview" subtitle="Current MTProxy counters.">
        <div className="grid gap-2 text-sm text-muted md:grid-cols-2">
          <div>Enabled users: {overview?.enabled_secrets ?? 0}</div>
          <div>Connections: {overview?.connections_total ?? 0}</div>
          <div>Total users: {overview?.users_total ?? 0}</div>
          <div>Service status: {service?.status_text || "-"}</div>
        </div>
      </Card>
    </div>
  );
}
