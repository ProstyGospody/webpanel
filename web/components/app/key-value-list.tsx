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
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "grid gap-1 border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center",
            index % 2 === 1 && "bg-muted/20"
          )}
        >
          <span className="font-medium text-muted-foreground">{item.label}</span>
          <span className={cn("truncate font-medium", item.valueClassName)}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

