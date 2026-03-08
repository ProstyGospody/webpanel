"use client";

import { useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ServiceState } from "@/lib/types";

type ServiceDetails = {
  name: string;
  status_text: string;
  checked_at: string;
  last_logs?: string[];
};

export default function ServicesPage() {
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
    loadServices().catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load services"));
  }, []);

  async function runAction(name: string, action: "restart" | "reload") {
    if (!confirm(`Run ${action} for ${name}?`)) {
      return;
    }
    await apiFetch(`/api/services/${name}/${action}`, {
      method: "POST",
      body: toJSONBody({}),
    });
    await loadServices();
    await loadService(name);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Services</h1>
      {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
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
                  <td colSpan={4} className="text-center text-slate-500">
                    No services found
                  </td>
                </tr>
              )}
              {services.map((service) => {
                const name = service.service_name || "unknown";
                return (
                  <tr key={name}>
                    <td>
                      <button className="text-left font-medium hover:underline" onClick={() => loadService(name)}>
                        {name}
                      </button>
                    </td>
                    <td>{service.status}</td>
                    <td>{formatDate(service.last_check_at)}</td>
                    <td className="space-x-2">
                      <button className="btn btn-muted" onClick={() => runAction(name, "reload")}>
                        Reload
                      </button>
                      <button className="btn btn-danger" onClick={() => runAction(name, "restart")}>
                        Restart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Service Details</h2>
          {!selected && <div className="text-sm text-slate-600">Select a service to see logs.</div>}
          {selected && !details && <div className="text-sm">Loading {selected}...</div>}
          {details && (
            <div className="space-y-2">
              <div className="text-sm">
                <strong>{details.name}</strong> · {details.status_text}
              </div>
              <div className="text-xs text-slate-500">Checked: {formatDate(details.checked_at)}</div>
              <pre className="max-h-96 overflow-auto rounded border border-slate-300 bg-slate-950 p-3 text-xs text-slate-100">
                {(details.last_logs || []).join("\n") || "No logs"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

