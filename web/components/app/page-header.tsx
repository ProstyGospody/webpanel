import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="max-w-4xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {(actions || meta) && (
        <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
          {actions && <div className="flex w-full flex-wrap items-center justify-start gap-2 md:w-auto md:justify-end">{actions}</div>}
          {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
        </div>
      )}
    </header>
  );
}

