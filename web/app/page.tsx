"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { LiveDashboardPayload, LiveServiceStatus } from "@/lib/types";
import { formatBytes, formatDate, formatRate, formatUptime } from "@/lib/format";
import { Card, MetricCard } from "@/components/ui";

const POLL_INTERVAL_MS = 5000;

function serviceBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "badge badge-online";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "badge badge-disabled";
  }
  return "badge badge-neutral";
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
      const message = err instanceof Error ? err.message : "Failed to load live dashboard";
      setError(message);
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
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Near-real-time server metrics, proxy status and traffic health.</p>
        </div>
        <div className="text-xs text-muted">
          {refreshing ? "Refreshing..." : "Auto refresh: 5s"}
          <br />
          Last update: {formatDate(data?.collected_at)}
        </div>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Server CPU"
          value={loading ? "Loading..." : `${system?.cpu_usage_percent?.toFixed(1) || "0.0"}%`}
          hint={system ? `${system.source}${system.is_stale ? " - stale" : " - live"}` : "-"}
        />
        <MetricCard
          label="Server RAM"
          value={
            loading
              ? "Loading..."
              : `${formatBytes(system?.memory_used_bytes)} / ${formatBytes(system?.memory_total_bytes)}`
          }
          hint={system ? `${system.memory_used_percent.toFixed(1)}% used` : "-"}
        />
        <MetricCard
          label="Server Uptime"
          value={loading ? "Loading..." : formatUptime(system?.uptime_seconds)}
          hint={system ? `Collected ${formatDate(system.collected_at)}` : "-"}
        />
        <MetricCard
          label="Network Throughput"
          value={loading ? "Loading..." : `RX ${formatRate(system?.network_rx_bps)}`}
          hint={loading ? "" : `TX ${formatRate(system?.network_tx_bps)}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Hysteria Online"
          value={String(data?.hysteria.online_count ?? 0)}
          hint={`${data?.hysteria.source || "snapshot"}${data?.hysteria.is_stale ? " - stale" : " - live"}`}
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
          hint={`${data?.mtproxy.source || "snapshot"}${data?.mtproxy.is_stale ? " - stale" : " - live"}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Proxy Services" subtitle="Runtime state from systemd with live fallback to cache.">
          <div className="space-y-2">
            {[hy2Service, mtService].map((item) => {
              if (!item) {
                return null;
              }
              return (
                <article key={item.service_name} className="list-row">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{item.service_name}</div>
                    <span className={serviceBadgeClass(item.status)}>{item.status}</span>
                  </div>
                  <div className="text-xs text-muted">
                    Checked: {formatDate(item.last_check_at)} | {item.source}
                    {item.is_stale ? " (stale)" : ""}
                  </div>
                  {item.error && <div className="text-xs text-muted">{item.error}</div>}
                </article>
              );
            })}

            {(!data?.services || data.services.length === 0) && !loading && <div className="empty-state">No service data.</div>}
          </div>
        </Card>

        <Card title="Live Notes" subtitle="How to read this dashboard.">
          <div className="space-y-2 text-sm text-muted">
            <p>System CPU/RAM/uptime comes from Prometheus + node_exporter when configured, with procfs fallback.</p>
            <p>Hysteria and MTProxy traffic are fetched live from local stats endpoints with snapshot fallback if unavailable.</p>
            <p>If a section is marked stale, values are fallback/cache and need runtime/API recovery.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
