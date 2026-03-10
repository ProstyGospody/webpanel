"use client";

import { useEffect, useState } from "react";
import { Activity, Settings, Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { MTProxySettingsPayload } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  { href: "/mtproxy/users", label: "Users", icon: Users },
  { href: "/mtproxy/settings", label: "Settings", icon: Settings },
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
      <PageHeader title="MTProxy" description="Runtime context and read-only service-linked proxy settings." />

      <SectionNav items={tabs} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Runtime parameters</CardTitle>
          <CardDescription>Resolved from backend configuration and runtime linkage.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              <SettingsRow label="Public host" value={settings?.public_host || "-"} />
              <SettingsRow label="Port" value={String(settings?.port || "-")} />
              <SettingsRow label="TLS domain" value={settings?.tls_domain || "-"} />
              <SettingsRow label="Stats URL" value={settings?.stats_url || "-"} />
              <SettingsRow label="Stats token" value={settings?.stats_token_config ? "Configured" : "Not configured"} />
              <SettingsRow label="Active runtime secret" value={settings?.runtime_secret_id || "-"} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live status</CardTitle>
          <CardDescription>Current counters and mtproxy.service health snapshot.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Enabled users" value={String(overview?.enabled_secrets ?? 0)} />
              <MetricCard label="Connections" value={String(overview?.connections_total ?? 0)} />
              <MetricCard label="Total users" value={String(overview?.users_total ?? 0)} />
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Service</p>
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <StatusBadge tone={serviceTone(service?.status_text || "")}>{service?.status_text || "-"}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Checked: {formatDate(service?.checked_at || null)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function serviceTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "success";
  }
  if (normalized.includes("reload") || normalized.includes("activating")) {
    return "warning";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "danger";
  }
  return "neutral";
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

