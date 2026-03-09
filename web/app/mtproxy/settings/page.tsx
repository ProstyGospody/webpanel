"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { MTProxySettingsPayload } from "@/lib/types";
import { Card, InlineMessage, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { SectionTabs } from "@/components/section-tabs";

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

const tabs = [
  { href: "/mtproxy/users", label: "Users", icon: "group" },
  { href: "/mtproxy/settings", label: "Settings", icon: "settings" },
];

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
    <div className="md-page-stack">
      <PageHeader
        title="MTProxy"
        subtitle="Runtime context and read-only service status for the active proxy node."
      />

      <SectionTabs items={tabs} />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Runtime" subtitle="Read-only runtime values from backend config.">
        <div className="md-form-grid">
          <div className="md-chip">Public host: {settings?.public_host || "-"}</div>
          <div className="md-chip">Port: {settings?.port || "-"}</div>
          <div className="md-chip">TLS domain: {settings?.tls_domain || "-"}</div>
          <div className="md-chip">Stats URL: {settings?.stats_url || "-"}</div>
          <div className="md-chip">Stats token configured: {settings?.stats_token_config ? "yes" : "no"}</div>
          <div className="md-chip">Active runtime secret: {settings?.runtime_secret_id || "-"}</div>
        </div>
      </Card>

      <Card title="Live overview" subtitle="Current MTProxy counters and service runtime health.">
        <div className="md-form-grid">
          <div className="md-chip md-chip--selected">Enabled users: {overview?.enabled_secrets ?? 0}</div>
          <div className="md-chip md-chip--selected">Connections: {overview?.connections_total ?? 0}</div>
          <div className="md-chip md-chip--selected">Total users: {overview?.users_total ?? 0}</div>
          <div className="md-chip md-chip--selected">Service status: {service?.status_text || "-"}</div>
        </div>
      </Card>
    </div>
  );
}

