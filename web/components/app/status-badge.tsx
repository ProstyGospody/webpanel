import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

type StatusBadgeProps = {
  tone?: StatusTone;
  children: string;
  className?: string;
};

const toneClass: Record<StatusTone, string> = {
  neutral: "border-border/70 bg-muted/30 text-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusBadge({ tone = "neutral", children, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-medium", toneClass[tone], className)}>
      {children}
    </Badge>
  );
}

