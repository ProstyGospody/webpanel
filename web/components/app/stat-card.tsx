import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  loading?: boolean;
};

export function StatCard({ label, value, description, icon, className, loading = false }: StatCardProps) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {loading ? (
          <Skeleton className="h-8 w-28 rounded-md" />
        ) : (
          <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
        )}
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}

