"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { AuditLog, ServiceState, SystemMetrics } from "@/lib/types";
import { formatBytes, formatDate, formatUptime } from "@/lib/format";
import { Card, MetricCard } from "@/components/ui";

type Hy2Overview = {
  enabled_accounts: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

type MTOverview = {
  enabled_secrets: number;
  connections_total?: number | null;
  users_total?: number | null;
};

function serviceBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "badge badge-online";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "badge badge-disabled";
  }
  return "badge badge-offline";
}

export default function DashboardPage() {
  const [hy2, setHy2] = useState<Hy2Overview | null>(null);
  const [mt, setMt] = useState<MTOverview | null>(null);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        apiFetch<Hy2Overview>("/api/hy2/stats/overview"),
        apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
        apiFetch<{ items: ServiceState[] }>("/api/services"),
        apiFetch<{ items: AuditLog[] }>("/api/audit?limit=10"),
        apiFetch<SystemMetrics>("/api/system/metrics"),
      ]);

      if (cancelled) {
        return;
      }

      const failures: string[] = [];

      if (results[0].status === "fulfilled") {
        setHy2(results[0].value);
      } else {
        failures.push("Hysteria overview unavailable");
      }

      if (results[1].status === "fulfilled") {
        setMt(results[1].value);
      } else {
        failures.push("MTProxy overview unavailable");
      }

      if (results[2].status === "fulfilled") {
        setServices(results[2].value.items || []);
      } else {
        failures.push("Services list unavailable");
      }

      if (results[3].status === "fulfilled") {
        setAudit(results[3].value.items || []);
      } else {
        failures.push("Audit feed unavailable");
      }

      if (results[4].status === "fulfilled") {
        setSystemMetrics(results[4].value);
      } else {
        failures.push("System metrics unavailable");
      }

      setError(failures.length > 0 ? failures.join(". ") : null);
      setLoading(false);
    }

    loadDashboard().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const cpuValue = systemMetrics ? `${systemMetrics.cpu_usage_percent.toFixed(1)}%` : "-";
  const ramValue = systemMetrics
    ? `${formatBytes(systemMetrics.memory_used_bytes)} / ${formatBytes(systemMetrics.memory_total_bytes)}`
    : "-";
  const ramHint = systemMetrics ? `${systemMetrics.memory_used_percent.toFixed(1)}% used` : "No data";
  const uptimeValue = systemMetrics ? formatUptime(systemMetrics.uptime_seconds) : "-";

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">Server health, traffic and service state in one view.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Server CPU" value={loading ? "Loading..." : cpuValue} hint="Average between short samples" />
        <MetricCard label="Server RAM" value={loading ? "Loading..." : ramValue} hint={ramHint} />
        <MetricCard label="Server Uptime" value={loading ? "Loading..." : uptimeValue} hint={systemMetrics ? formatDate(systemMetrics.collected_at) : "-"} />
        <MetricCard label="Hysteria Online" value={String(hy2?.online_count ?? 0)} hint="Active sessions" />
        <MetricCard
          label="Hysteria Traffic"
          value={`TX ${formatBytes(hy2?.total_tx_bytes ?? 0)}`}
          hint={`RX ${formatBytes(hy2?.total_rx_bytes ?? 0)}`}
        />
        <MetricCard
          label="MTProxy"
          value={`${mt?.enabled_secrets ?? 0} enabled`}
          hint={`Conn ${mt?.connections_total ?? 0} / Users ${mt?.users_total ?? 0}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Service Status" subtitle="Current state of managed services.">
          {services.length === 0 && !loading && <div className="empty-state">No service data yet.</div>}

          <div className="md:hidden space-y-2">
            {services.map((item) => (
              <article key={`${item.service_name}-${item.last_check_at}`} className="list-row">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{item.service_name || "-"}</div>
                  <span className={serviceBadgeClass(item.status)}>{item.status}</span>
                </div>
                <div className="text-xs text-muted">Checked: {formatDate(item.last_check_at)}</div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Checked</th>
                </tr>
              </thead>
              <tbody>
                {services.map((item) => (
                  <tr key={`${item.service_name}-${item.last_check_at}`}>
                    <td>{item.service_name || "-"}</td>
                    <td>
                      <span className={serviceBadgeClass(item.status)}>{item.status}</span>
                    </td>
                    <td>{formatDate(item.last_check_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Recent Audit" subtitle="Last 10 administrative actions.">
          {audit.length === 0 && !loading && <div className="empty-state">No audit records yet.</div>}

          <div className="md:hidden space-y-2">
            {audit.map((row) => (
              <article key={row.id} className="list-row">
                <div className="text-xs text-muted">{formatDate(row.created_at)}</div>
                <div className="font-medium">{row.action}</div>
                <div className="text-sm text-muted">{row.admin_email || "system"}</div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.admin_email || "system"}</td>
                    <td>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

