"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { LiveDashboardPayload, LiveServiceStatus } from "@/lib/types";
import { formatBytes, formatDate, formatRate, formatUptime } from "@/lib/format";
import { Card, EmptyState, InlineMessage, LinearProgress, MetricCard, PageHeader, StatusBadge } from "@/components/ui";

const POLL_INTERVAL_MS = 5000;

function serviceTone(status: string): "success" | "error" | "warning" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "success";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "error";
  }
  if (normalized.includes("reloading") || normalized.includes("activating")) {
    return "warning";
  }
  return "neutral";
}

function findService(services: LiveServiceStatus[], name: string): LiveServiceStatus | null {
  return services.find((item) => item.service_name === name) || null;
}

export default function DashboardPage() {
  const [data, setData] = useState<LiveDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const payload = await apiFetch<LiveDashboardPayload>("/api/system/live");
      setData(payload);
      const backendIssues = (payload.errors || []).filter((item, idx, all) => item && all.indexOf(item) === idx);
      setError(backendIssues.length > 0 ? backendIssues.join(". ") : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    load(true).catch(() => {
      // handled in load
    });

    const timer = window.setInterval(() => {
      if (!cancelled) {
        load(false).catch(() => {
          // handled in load
        });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const system = data?.system;
  const hy2Service = useMemo(() => findService(data?.services || [], "hysteria-server"), [data]);
  const mtService = useMemo(() => findService(data?.services || [], "mtproxy"), [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Live system health, protocol traffic and service runtime state in one view."
        meta={
          <>
            {refreshing ? "Refreshing..." : "Auto refresh: 5s"}
            <br />
            Last update: {formatDate(data?.collected_at)}
          </>
        }
      />

      {(loading || refreshing) && <LinearProgress indeterminate />}

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="System and protocol metrics">
        <MetricCard
          label="CPU"
          value={loading ? "Loading..." : `${system?.cpu_usage_percent?.toFixed(1) || "0.0"}%`}
          hint={system ? `${system.source}${system.is_stale ? " РІР‚Сћ stale" : " РІР‚Сћ live"}` : "-"}
        />
        <MetricCard
          label="Memory"
          value={loading ? "Loading..." : `${formatBytes(system?.memory_used_bytes)} / ${formatBytes(system?.memory_total_bytes)}`}
          hint={system ? `${system.memory_used_percent.toFixed(1)}% used` : "-"}
        />
        <MetricCard
          label="Uptime"
          value={loading ? "Loading..." : formatUptime(system?.uptime_seconds)}
          hint={system ? `Collected ${formatDate(system.collected_at)}` : "-"}
        />
        <MetricCard
          label="Network"
          value={loading ? "Loading..." : `RX ${formatRate(system?.network_rx_bps)}`}
          hint={loading ? "" : `TX ${formatRate(system?.network_tx_bps)}`}
        />
        <MetricCard
          label="Hysteria Online"
          value={String(data?.hysteria.online_count ?? 0)}
          hint={`${data?.hysteria.source || "snapshot"}${data?.hysteria.is_stale ? " РІР‚Сћ stale" : " РІР‚Сћ live"}`}
        />
        <MetricCard
          label="Hysteria Traffic"
          value={`TX ${formatBytes(data?.hysteria.total_tx_bytes ?? 0)}`}
          hint={`RX ${formatBytes(data?.hysteria.total_rx_bytes ?? 0)}`}
        />
        <MetricCard
          label="MTProxy Connections"
          value={String(data?.mtproxy.connections_total ?? 0)}
          hint={`Users ${data?.mtproxy.users_total ?? 0}`}
        />
        <MetricCard
          label="MTProxy Enabled"
          value={String(data?.mtproxy.enabled_secrets ?? 0)}
          hint={`${data?.mtproxy.source || "snapshot"}${data?.mtproxy.is_stale ? " РІР‚Сћ stale" : " РІР‚Сћ live"}`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Service status"
          subtitle="Runtime state from systemd with automatic fallback to cached checks."
        >
          <div className="space-y-3">
            {[hy2Service, mtService].map((item) => {
              if (!item) {
                return null;
              }

              return (
                <article key={item.service_name} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">{item.service_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Checked: {formatDate(item.last_check_at)} РІР‚Сћ {item.source}
                        {item.is_stale ? " (stale)" : ""}
                      </p>
                    </div>
                    <StatusBadge tone={serviceTone(item.status)}>{item.status}</StatusBadge>
                  </div>
                  {item.error && <p className="mt-2 text-sm text-muted-foreground">{item.error}</p>}
                </article>
              );
            })}

            {(!data?.services || data.services.length === 0) && !loading && (
              <EmptyState
                title="No service data"
                description="No runtime status is currently available from backend services."
                icon="dns"
              />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2" title="Data notes" subtitle="How metrics are collected and interpreted.">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>CPU, RAM and uptime are collected via Prometheus/node_exporter with procfs fallback.</li>
            <li>Hysteria and MTProxy counters are loaded from live runtime endpoints with snapshot fallback.</li>
            <li>Stale status means runtime source is currently unavailable and cached values are shown.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

