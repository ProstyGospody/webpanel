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
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between", className)}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
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

