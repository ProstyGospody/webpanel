"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, MaterialIcon } from "@/components/ui";

type TabItem = {
  href: string;
  label: string;
  icon?: string;
};

type SectionTabsProps = {
  items: TabItem[];
};

export function SectionTabs({ items }: SectionTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="w-full overflow-x-auto" aria-label="Section navigation">
      <div className="inline-flex min-w-max items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              )}
            >
              {item.icon && <MaterialIcon name={item.icon} className="size-4" />}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
