import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({ title, description, action, icon: Icon = Inbox, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border/80">
        <Icon className="size-5" />
      </div>
      <p className="text-base font-medium tracking-tight">{title}</p>
      {description ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

