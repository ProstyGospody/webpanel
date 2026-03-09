"use client";

import Link from "next/link";

import { Card, MaterialIcon, PageHeader } from "@/components/ui";

export default function SettingsHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Centralized configuration surfaces for protocol runtimes and panel behavior."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Hysteria 2" subtitle="Transport, OBFS, Masquerade and runtime apply flow." outlined>
          <Link
            href="/hysteria/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <MaterialIcon name="settings_ethernet" />
            Open Hysteria settings
          </Link>
        </Card>

        <Card title="MTProxy" subtitle="Runtime context and service-linked proxy parameters." outlined>
          <Link
            href="/mtproxy/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <MaterialIcon name="vpn_key" />
            Open MTProxy settings
          </Link>
        </Card>
      </div>
    </div>
  );
}

