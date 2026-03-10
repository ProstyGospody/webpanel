import Link from "next/link";
import { Send, Zap } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure Hysteria 2 and MTProxy." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hysteria 2</CardTitle>
            <CardDescription>Server configuration and advanced YAML.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/hysteria/settings" className="inline-flex">
              <Button variant="secondary">
                <Zap className="size-4" />
                Open Hysteria settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MTProxy</CardTitle>
            <CardDescription>Runtime parameters and service state.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/mtproxy/settings" className="inline-flex">
              <Button variant="secondary">
                <Send className="size-4" />
                Open MTProxy settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
