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
    <div className="md-page-stack">
      <PageHeader
        title="Dashboard"
        subtitle="Near-real-time server metrics, proxy status and traffic health."
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

      <section className="md-metric-grid" aria-label="System and protocol metrics">
        <MetricCard
          label="Server CPU"
          value={loading ? "Loading..." : `${system?.cpu_usage_percent?.toFixed(1) || "0.0"}%`}
          hint={system ? `${system.source}${system.is_stale ? " - stale" : " - live"}` : "-"}
        />
        <MetricCard
          label="Server RAM"
          value={loading ? "Loading..." : `${formatBytes(system?.memory_used_bytes)} / ${formatBytes(system?.memory_total_bytes)}`}
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
      </section>

      <div className="md-grid-two">
        <Card title="Proxy Services" subtitle="Runtime state from systemd with live fallback to cache.">
          <div className="md-list">
            {[hy2Service, mtService].map((item) => {
              if (!item) {
                return null;
              }
              return (
                <article key={item.service_name} className="md-list-item">
                  <div className="md-list-item__row">
                    <div>
                      <h3 className="md-list-item__headline">{item.service_name}</h3>
                      <p className="md-list-item__supporting">
                        Checked: {formatDate(item.last_check_at)} | {item.source}
                        {item.is_stale ? " (stale)" : ""}
                      </p>
                    </div>
                    <StatusBadge tone={serviceTone(item.status)}>{item.status}</StatusBadge>
                  </div>
                  {item.error && <p className="md-list-item__supporting">{item.error}</p>}
                </article>
              );
            })}

            {(!data?.services || data.services.length === 0) && !loading && (
              <EmptyState title="No service data" description="No runtime status is currently available from backend services." icon="dns" />
            )}
          </div>
        </Card>

        <Card title="Live Notes" subtitle="How to read this dashboard.">
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0 }}>
              System CPU, RAM and uptime are collected via Prometheus + node_exporter when configured, with procfs fallback.
            </p>
            <p style={{ margin: 0 }}>
              Hysteria and MTProxy traffic are read from local live endpoints, with cache fallback when runtime sources are unavailable.
            </p>
            <p style={{ margin: 0 }}>
              If a section is marked stale, metrics are fallback values and runtime/API recovery is required.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

