"use client";

import Link from "next/link";

import { Card, MaterialIcon, PageHeader } from "@/components/ui";

export default function SettingsHubPage() {
  return (
    <div className="md-page-stack">
      <PageHeader
        title="Settings"
        subtitle="Centralized configuration surfaces for protocol runtimes and panel behavior."
      />

      <div className="md-grid-two">
        <Card title="Hysteria 2" subtitle="Transport, OBFS, Masquerade and runtime apply flow." outlined>
          <Link href="/hysteria/settings" className="md-button md-button--tonal" style={{ width: "fit-content" }}>
            <MaterialIcon name="settings_ethernet" />
            Open Hysteria settings
          </Link>
        </Card>

        <Card title="MTProxy" subtitle="Runtime context and service-linked proxy parameters." outlined>
          <Link href="/mtproxy/settings" className="md-button md-button--tonal" style={{ width: "fit-content" }}>
            <MaterialIcon name="vpn_key" />
            Open MTProxy settings
          </Link>
        </Card>
      </div>
    </div>
  );
}

