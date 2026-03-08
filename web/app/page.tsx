"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { AuditLog, ServiceState } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/format";
import { Card } from "@/components/ui";

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

export default function DashboardPage() {
  const [hy2, setHy2] = useState<Hy2Overview | null>(null);
  const [mt, setMt] = useState<MTOverview | null>(null);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Hy2Overview>("/api/hy2/stats/overview"),
      apiFetch<MTOverview>("/api/mtproxy/stats/overview"),
      apiFetch<{ items: ServiceState[] }>("/api/services"),
      apiFetch<{ items: AuditLog[] }>("/api/audit?limit=10"),
    ])
      .then(([hy2Resp, mtResp, servicesResp, auditResp]) => {
        if (cancelled) {
          return;
        }
        setHy2(hy2Resp);
        setMt(mtResp);
        setServices(servicesResp.items || []);
        setAudit(auditResp.items || []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Hysteria Online">
          <p className="text-2xl font-semibold">{hy2?.online_count ?? 0}</p>
        </Card>
        <Card title="Hysteria Traffic">
          <p className="text-sm">TX: {formatBytes(hy2?.total_tx_bytes ?? 0)}</p>
          <p className="text-sm">RX: {formatBytes(hy2?.total_rx_bytes ?? 0)}</p>
        </Card>
        <Card title="MTProxy Secrets">
          <p className="text-2xl font-semibold">{mt?.enabled_secrets ?? 0}</p>
          <p className="text-sm">Connections: {mt?.connections_total ?? 0}</p>
        </Card>
        <Card title="MTProxy Users">
          <p className="text-2xl font-semibold">{mt?.users_total ?? 0}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Service Status">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Checked</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500">
                    No service data
                  </td>
                </tr>
              )}
              {services.map((item) => (
                <tr key={item.service_name || item.status}>
                  <td>{item.service_name || "-"}</td>
                  <td>{item.status}</td>
                  <td>{formatDate(item.last_check_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Recent Audit">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Admin</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500">
                    No audit records
                  </td>
                </tr>
              )}
              {audit.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>{row.admin_email || "system"}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

