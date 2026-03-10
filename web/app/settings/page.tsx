import Link from "next/link";
import { Send, Settings, Zap } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" icon={<Settings />} description="Choose a service to configure." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-4 text-muted-foreground" />
              Hysteria 2
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <Link href="/hysteria/settings" className="inline-flex">
              <Button variant="secondary">Open settings</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2">
              <Send className="size-4 text-muted-foreground" />
              MTProxy
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <Link href="/mtproxy/settings" className="inline-flex">
              <Button variant="secondary">Open settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
