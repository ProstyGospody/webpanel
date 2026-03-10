import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {icon ? (
            <span className="grid size-8 place-items-center rounded-md bg-muted/35 text-muted-foreground [&>svg]:size-4.5">
              {icon}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? <Skeleton className="h-9 w-28 rounded-md" /> : <p className="text-3xl font-semibold tabular-nums">{value}</p>}
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

