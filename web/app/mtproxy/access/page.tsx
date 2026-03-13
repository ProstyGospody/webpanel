"use client";

import { useEffect, useState } from "react";
import { Activity, Copy, ExternalLink, Link2, QrCode, Send, Settings2 } from "lucide-react";

import { APIError, apiFetch } from "@/lib/api";
import { copyToClipboard, formatDate } from "@/lib/format";
import type { MTProxyAccess, MTProxyOverview, ServiceDetails } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/app/page-header";
import { SectionNav } from "@/components/app/section-nav";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Dialog } from "@/components/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/app/fields";

const tabs = [
  { href: "/mtproxy/settings", label: "Settings", icon: Settings2 },
  { href: "/mtproxy/access", label: "Access", icon: Link2 },
];

export default function MTProxyAccessPage() {
  const { push } = useToast();

  const [access, setAccess] = useState<MTProxyAccess | null>(null);
  const [overview, setOverview] = useState<MTProxyOverview | null>(null);
  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const accessRequest = apiFetch<MTProxyAccess>("/api/mtproxy/access").catch((err: unknown) => {
      if (err instanceof APIError && err.status === 404) {
        return null;
      }
      throw err;
    });

    Promise.all([
      accessRequest,
      apiFetch<MTProxyOverview>("/api/mtproxy/stats/overview"),
      apiFetch<ServiceDetails>("/api/services/mtproxy?lines=1"),
    ])
      .then(([accessPayload, overviewPayload, servicePayload]) => {
        setAccess(accessPayload);
        setOverview(overviewPayload);
        setService(servicePayload);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load MTProxy access";
        setError(message);
        push(message, "error");
      })
      .finally(() => setLoading(false));
  }, [push]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="MTProxy Access"
        icon={<Send />}
        description="Shared connection block for Telegram. MTProxy does not have per-user accounts in this panel; all share links and QR codes come from one canonical secret."
      />

      <SectionNav items={tabs} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Access" value={overview?.access_enabled ? "Enabled" : "Disabled"} loading={loading} icon={<Link2 />} />
        <StatCard label="Connections" value={String(overview?.connections_total ?? 0)} loading={loading} icon={<Activity />} />
        <StatCard label="Share mode" value={access?.settings.share_mode || "telegram"} loading={loading} icon={<Send />} />
        <Card size="sm" className="gap-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusBadge tone={statusTone(service?.status_text || "")}>{service?.status_text || (loading ? "Loading" : "Unknown")}</StatusBadge>
            <p className="text-xs text-muted-foreground">Updated {formatDate(service?.checked_at || null)}</p>
          </CardContent>
        </Card>
      </section>

      {!loading && !access?.telegram_url ? (
        <EmptyState
          title="MTProxy access is not configured"
          description="Save a valid public host, port, and canonical secret on the settings page to generate the Telegram share URL and QR code."
          icon={Link2}
          action={<Button type="button" onClick={() => { window.location.href = "/mtproxy/settings"; }}>Open settings</Button>}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Telegram share links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <Alert>
                <AlertTitle>Shared secret</AlertTitle>
                <AlertDescription>Use the primary <code>https://t.me/proxy</code> link for sharing. The <code>tg://proxy</code> deep link is shown separately for clients that prefer it.</AlertDescription>
              </Alert>
              <TextField label="Primary share URL" value={access?.telegram_url || ""} readOnly disabled />
              <TextField label="Telegram deep link" value={access?.telegram_deep_url || ""} readOnly disabled />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Public host" value={access?.settings.public_host || ""} readOnly disabled />
                <TextField label="Port" value={String(access?.settings.listen_port || "")} readOnly disabled />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void copyValue(access?.telegram_url || "", push)} disabled={!access?.telegram_url}>
                  <Copy className="size-4" />
                  Copy share URL
                </Button>
                <Button variant="outline" onClick={() => void copyValue(access?.telegram_deep_url || "", push)} disabled={!access?.telegram_deep_url}>
                  <ExternalLink className="size-4" />
                  Copy deep link
                </Button>
                <Button onClick={() => setQrOpen(true)} disabled={!access?.telegram_url}>
                  <QrCode className="size-4" />
                  Show QR
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Access notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-sm text-muted-foreground">
              <p>This panel never forwards user traffic. It only stores the canonical MTProxy secret, generates Telegram connection artifacts, and applies settings to the native service runtime.</p>
              <p>Changing the canonical secret invalidates previously shared links. Save and redistribute the new <code>t.me/proxy</code> URL if you rotate credentials.</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title="MTProxy QR" description="QR encodes the primary https://t.me/proxy share URL.">
        <div className="flex items-center justify-center rounded-2xl border bg-muted/10 p-4">
          {access?.telegram_url ? <img src="/api/mtproxy/access/qr?size=360" alt="MTProxy share QR" className="h-72 w-72 rounded-xl bg-white p-3 object-contain" /> : null}
        </div>
      </Dialog>
    </div>
  );
}

async function copyValue(value: string, push: (message: string, tone?: "info" | "success" | "error") => void) {
  if (!value) {
    return;
  }
  try {
    await copyToClipboard(value);
    push("Copied", "success");
  } catch {
    push("Copy failed", "error");
  }
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) {
    return "success";
  }
  if (normalized.includes("reload") || normalized.includes("activating")) {
    return "warning";
  }
  if (normalized.includes("failed") || normalized.includes("dead") || normalized.includes("inactive")) {
    return "danger";
  }
  return "neutral";
}



