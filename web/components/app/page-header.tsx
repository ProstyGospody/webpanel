import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  icon?: ReactNode;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({ title, icon, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between", className)}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground [&>svg]:size-5">{icon}</span> : null}
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        </div>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions || meta ? (
        <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
          {actions ? <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div> : null}
          {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
