"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { MTProxySettingsPayload } from "@/lib/types";
import { Card, InlineMessage, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { SectionTabs } from "@/components/section-tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<MTProxySettingsPayload>("/api/mtproxy/settings"),
      apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
      apiFetch<ServiceDetails>("/api/services/mtproxy?lines=1"),
    ])
      .then(([settingsPayload, overviewPayload, servicePayload]) => {
        setSettings(settingsPayload);
        setOverview(overviewPayload);
        setService(servicePayload);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load MTProxy settings";
        setError(message);
        push(message, "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [push]);

  return (
    <div className="space-y-6">
      <PageHeader title="MTProxy" subtitle="Runtime context and read-only status for the active proxy node." />

      <SectionTabs items={tabs} />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Runtime parameters" subtitle="Resolved from backend configuration and runtime linkage.">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : (
          <div className="divide-y rounded-lg border border-border/70">
            <SettingsRow label="Public host" value={settings?.public_host || "-"} />
            <SettingsRow label="Port" value={String(settings?.port || "-")} />
            <SettingsRow label="TLS domain" value={settings?.tls_domain || "-"} />
            <SettingsRow label="Stats URL" value={settings?.stats_url || "-"} />
            <SettingsRow
              label="Stats token"
              value={settings?.stats_token_config ? "Configured" : "Not configured"}
            />
            <SettingsRow label="Active runtime secret" value={settings?.runtime_secret_id || "-"} />
          </div>
        )}
      </Card>

      <Card title="Live status" subtitle="Current counters and mtproxy.service health snapshot.">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBadge label="Enabled users" value={String(overview?.enabled_secrets ?? 0)} />
            <MetricBadge label="Connections" value={String(overview?.connections_total ?? 0)} />
            <MetricBadge label="Total users" value={String(overview?.users_total ?? 0)} />
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Service</p>
              <p className="mt-1 text-sm font-medium">{service?.status_text || "-"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Checked: {formatDate(service?.checked_at || null)}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        <Badge variant="outline">live</Badge>
      </div>
    </div>
  );
}
