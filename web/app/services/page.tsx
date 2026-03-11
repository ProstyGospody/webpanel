"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw, RotateCcw, Search, TerminalSquare, Wrench, X } from "lucide-react";

import { apiFetch, toJSONBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ServiceState } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/dialog";
import { OverflowMenu } from "@/components/overflow-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAction, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
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

function statusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "success";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "danger";
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
  const [search, setSearch] = useState("");

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return services;
    }

    return services.filter((service) => {
      return (
        (service.service_name || "").toLowerCase().includes(q) ||
        (service.status || "").toLowerCase().includes(q)
      );
    });
  }, [search, services]);

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
      <PageHeader title="Services" icon={<Wrench />} description="Service status and controls." />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Managed services</CardTitle>
              <InputGroup className="w-full max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search service name or status"
                  aria-label="Search services"
                />
                {search ? (
                  <InputGroupAction aria-label="Clear search" onClick={() => setSearch("")}>
                    <X className="size-3.5" />
                  </InputGroupAction>
                ) : null}
              </InputGroup>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {services.length === 0 ? (
              <EmptyState title="No services found" description="No managed services detected." icon={Wrench} />
            ) : filteredServices.length === 0 ? (
              <EmptyState title="No matches" description="No services match the current search." icon={Wrench} />
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
                  {filteredServices.map((service) => {
                    const name = service.service_name || "unknown";
                    return (
                      <TableRow key={name}>
                        <TableCell>
                          <button type="button" onClick={() => void loadService(name)} className="text-left font-medium hover:underline">
                            {name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge tone={statusTone(service.status)}>{service.status}</StatusBadge>
                            <Popover>
                              <PopoverTrigger render={<Button variant="ghost" size="icon-xs" className="shrink-0" />} aria-label={`Status details for ${name}`}>
                                <Info className="size-3.5" />
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64 space-y-1.5">
                                <p className="text-sm font-medium">{name}</p>
                                <p className="text-xs text-muted-foreground">{service.status}</p>
                                <p className="text-xs text-muted-foreground">Last check {formatDate(service.last_check_at)}</p>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(service.last_check_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <OverflowMenu
                              items={[
                                {
                                  id: "reload",
                                  label: "Reload service",
                                  icon: RefreshCw,
                                  onSelect: () => setPendingAction({ service: name, action: "reload" }),
                                },
                                {
                                  id: "restart",
                                  label: "Restart service",
                                  icon: RotateCcw,
                                  destructive: true,
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>Service logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {!selected && (
              <EmptyState title="Select a service" description="Pick a service to view status and logs." icon={TerminalSquare} />
            )}
            {selected && loadingDetails && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            )}
            {details && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{details.name}</strong>
                  <StatusBadge tone={statusTone(details.status_text)}>{details.status_text}</StatusBadge>
                </div>
                <div className="text-sm text-muted-foreground">Updated {formatDate(details.checked_at)}</div>
                <pre className="max-h-[360px] overflow-auto rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
                  {(details.last_logs || []).join("\n") || "No logs"}
                </pre>
              </div>
            )}
          </CardContent>
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
