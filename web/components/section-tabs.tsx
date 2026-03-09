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
    <nav className="w-full overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-1" aria-label="Section navigation">
      <div className="flex min-w-max items-center gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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

