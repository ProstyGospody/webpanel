"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Settings, Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { MTProxySettingsPayload } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { StatusBadge } from "@/components/app/status-badge";
import { StatCard } from "@/components/app/stat-card";
import { KeyValueList } from "@/components/app/key-value-list";
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

  const runtimeItems = useMemo(
    () => [
      { label: "Public host", value: settings?.public_host || "-" },
      { label: "Port", value: String(settings?.port || "-") },
      { label: "TLS domain", value: settings?.tls_domain || "-" },
      { label: "Stats URL", value: settings?.stats_url || "-" },
      { label: "Stats token", value: settings?.stats_token_config ? "Configured" : "Not configured" },
      { label: "Active runtime secret", value: settings?.runtime_secret_id || "-" },
    ],
    [settings]
  );

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
      <PageHeader title="MTProxy" description="MTProxy runtime settings." />

      <SectionNav items={tabs} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Runtime parameters</CardTitle>

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
            <KeyValueList items={runtimeItems} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live status</CardTitle>

        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Enabled" value={String(overview?.enabled_secrets ?? 0)} />
              <StatCard label="Connections" value={String(overview?.connections_total ?? 0)} />
              <StatCard label="Users" value={String(overview?.users_total ?? 0)} />
              <Card size="sm" className="gap-2">
                <CardHeader className="pb-0">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">Service</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-muted-foreground" />
                    <StatusBadge tone={serviceTone(service?.status_text || "")}>{service?.status_text || "-"}</StatusBadge>
                  </div>
                  <CardDescription>Updated: {formatDate(service?.checked_at || null)}</CardDescription>
                </CardContent>
              </Card>
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
