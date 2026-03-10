import Link from "next/link";
import { KeyRound, Waves } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Centralized configuration surfaces for protocol runtimes and panel behavior."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hysteria 2</CardTitle>
            <CardDescription>Minimal server setup, client URI/QR output, and advanced raw YAML mode.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/hysteria/settings" className="inline-flex">
              <Button variant="secondary">
                <Waves className="size-4" />
                Open Hysteria settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MTProxy</CardTitle>
            <CardDescription>Runtime context and service-linked proxy parameters.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/mtproxy/settings" className="inline-flex">
              <Button variant="secondary">
                <KeyRound className="size-4" />
                Open MTProxy settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


