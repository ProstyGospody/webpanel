"use client";

import { useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ServiceState } from "@/lib/types";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

type ServiceDetails = {
  name: string;
  status_text: string;
  checked_at: string;
  last_logs?: string[];
};

const POLL_INTERVAL_MS = 10000;

export default function ServicesPage() {
  const { push } = useToast();
  const [services, setServices] = useState<ServiceState[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<ServiceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadServices() {
    const response = await apiFetch<{ items: ServiceState[] }>("/api/services");
    setServices(response.items || []);
  }

  async function loadService(name: string) {
    const data = await apiFetch<ServiceDetails>(`/api/services/${name}?lines=120`);
    setDetails(data);
    setSelected(name);
  }

  useEffect(() => {
    let cancelled = false;

    loadServices().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load services";
      setError(msg);
      push(msg, "error");
    });

    const timer = window.setInterval(() => {
      if (!cancelled) {
        loadServices().catch(() => {
          // ignore periodic errors
        });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [push]);

  async function runAction(name: string, action: "restart" | "reload") {
    try {
      await apiFetch(`/api/services/${name}/${action}`, {
        method: "POST",
        body: toJSONBody({}),
      });
      await loadServices();
      await loadService(name);
      push(action === "restart" ? "Service restarted" : "Service reloaded", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} service`;
      setError(msg);
      push(msg, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">Control systemd state and inspect recent service logs.</p>
        </div>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Managed Services" subtitle="Auto-refresh every 10 seconds.">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Checked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      No services found
                    </td>
                  </tr>
                )}
                {services.map((service) => {
                  const name = service.service_name || "unknown";
                  return (
                    <tr key={name}>
                      <td>
                        <button className="btn btn-ghost" onClick={() => loadService(name)}>
                          {name}
                        </button>
                      </td>
                      <td>{service.status}</td>
                      <td>{formatDate(service.last_check_at)}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-ghost" onClick={() => runAction(name, "reload")}>Reload</button>
                          <button className="btn btn-danger" onClick={() => runAction(name, "restart")}>Restart</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Service Logs" subtitle="Last 120 lines for selected service.">
          {!selected && <div className="empty-state">Select a service to see logs.</div>}
          {selected && !details && <div className="text-sm text-muted">Loading {selected}...</div>}
          {details && (
            <div className="space-y-2">
              <div className="text-sm">
                <strong>{details.name}</strong> | {details.status_text}
              </div>
              <div className="text-xs text-muted">Checked: {formatDate(details.checked_at)}</div>
              <pre className="input max-h-96 overflow-auto text-xs">{(details.last_logs || []).join("\n") || "No logs"}</pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
