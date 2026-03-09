"use client";

import { useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ServiceState } from "@/lib/types";
import { Button, Card, EmptyState, InlineMessage, PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { OverflowMenu } from "@/components/overflow-menu";
import { ConfirmDialog } from "@/components/dialog";

type ServiceDetails = {
  name: string;
  status_text: string;
  checked_at: string;
  last_logs?: string[];
};

type PendingAction = {
  service: string;
  action: "restart" | "reload";
};

const POLL_INTERVAL_MS = 10000;

function statusTone(status: string): "success" | "error" | "warning" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "success";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "error";
  }
  if (normalized.includes("reload") || normalized.includes("activating")) {
    return "warning";
  }
  return "neutral";
}

export default function ServicesPage() {
  const { push } = useToast();
  const [services, setServices] = useState<ServiceState[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<ServiceDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [runningAction, setRunningAction] = useState(false);

  async function loadServices() {
    const response = await apiFetch<{ items: ServiceState[] }>("/api/services");
    setServices(response.items || []);
  }

  async function loadService(name: string) {
    setLoadingDetails(true);
    try {
      const data = await apiFetch<ServiceDetails>(`/api/services/${name}?lines=120`);
      setDetails(data);
      setSelected(name);
    } finally {
      setLoadingDetails(false);
    }
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
    setRunningAction(true);
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
    } finally {
      setRunningAction(false);
      setPendingAction(null);
    }
  }

  return (
    <div className="md-page-stack">
      <PageHeader
        title="Services"
        subtitle="Control systemd services, run safe operations and inspect the latest runtime logs."
      />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <div className="md-grid-two">
        <Card title="Managed services" subtitle="Runtime state auto-refreshes every 10 seconds.">
          {services.length === 0 ? (
            <EmptyState title="No services found" description="Backend did not return managed systemd units." icon="dns" />
          ) : (
            <div className="md-data-table-wrap">
              <table className="md-data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Checked</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => {
                    const name = service.service_name || "unknown";
                    return (
                      <tr key={name}>
                        <td>
                          <Button variant="text" onClick={() => void loadService(name)}>
                            {name}
                          </Button>
                        </td>
                        <td>
                          <StatusBadge tone={statusTone(service.status)}>{service.status}</StatusBadge>
                        </td>
                        <td>{formatDate(service.last_check_at)}</td>
                        <td>
                          <div className="md-row-actions">
                            <Button variant="text" onClick={() => void loadService(name)}>
                              View logs
                            </Button>
                            <OverflowMenu
                              items={[
                                {
                                  id: "reload",
                                  label: "Reload service",
                                  icon: "sync",
                                  onSelect: () => setPendingAction({ service: name, action: "reload" }),
                                },
                                {
                                  id: "restart",
                                  label: "Restart service",
                                  icon: "restart_alt",
                                  danger: true,
                                  onSelect: () => setPendingAction({ service: name, action: "restart" }),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Service logs" subtitle="Latest 120 journal lines for selected service.">
          {!selected && <EmptyState title="Select a service" description="Choose a service to inspect runtime status and logs." icon="receipt_long" />}
          {selected && loadingDetails && <InlineMessage tone="info">Loading {selected}...</InlineMessage>}
          {details && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{details.name}</strong>
                <StatusBadge tone={statusTone(details.status_text)}>{details.status_text}</StatusBadge>
              </div>
              <div className="text-muted" style={{ fontSize: "0.875rem" }}>
                Checked: {formatDate(details.checked_at)}
              </div>
              <pre className="md-pre md-mono">{(details.last_logs || []).join("\n") || "No logs"}</pre>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={`${pendingAction?.action === "restart" ? "Restart" : "Reload"} service`}
        description={`Execute ${pendingAction?.action || "operation"} for ${pendingAction?.service || "service"}?`}
        confirmLabel={pendingAction?.action === "restart" ? "Restart" : "Reload"}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) {
            return;
          }
          void runAction(pendingAction.service, pendingAction.action);
        }}
        busy={runningAction}
        danger={pendingAction?.action === "restart"}
      />
    </div>
  );
}

