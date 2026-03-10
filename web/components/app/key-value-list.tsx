import { cn } from "@/lib/utils";

type KeyValueItem = {
  label: string;
  value: string;
  valueClassName?: string;
};

type KeyValueListProps = {
  items: KeyValueItem[];
  className?: string;
};

export function KeyValueList({ items, className }: KeyValueListProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="grid gap-1 border-b px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center"
        >
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</span>
          <span className={cn("truncate font-medium", item.valueClassName)}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

