"use client";

import { useEffect, useState } from "react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ServiceState } from "@/lib/types";
import { Button, Card, EmptyState, InlineMessage, PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { OverflowMenu } from "@/components/overflow-menu";
import { ConfirmDialog } from "@/components/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    <div className="space-y-6">
      <PageHeader
        title="Services"
        subtitle="Control systemd units, run safe operations and inspect runtime journal logs."
      />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Managed services" subtitle="Runtime state auto-refreshes every 10 seconds.">
          {services.length === 0 ? (
            <EmptyState title="No services found" description="Backend did not return managed systemd units." icon="dns" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Checked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const name = service.service_name || "unknown";
                  return (
                    <TableRow key={name}>
                      <TableCell>
                        <Button variant="text" onClick={() => void loadService(name)}>
                          {name}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone(service.status)}>{service.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(service.last_check_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="Service logs" subtitle="Latest 120 journal lines for selected service.">
          {!selected && (
            <EmptyState title="Select a service" description="Choose a service to inspect runtime status and logs." icon="receipt_long" />
          )}
          {selected && loadingDetails && <InlineMessage tone="info">Loading {selected}...</InlineMessage>}
          {details && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{details.name}</strong>
                <StatusBadge tone={statusTone(details.status_text)}>{details.status_text}</StatusBadge>
              </div>
              <div className="text-sm text-muted-foreground">Checked: {formatDate(details.checked_at)}</div>
              <pre className="rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
                {(details.last_logs || []).join("\n") || "No logs"}
              </pre>
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

