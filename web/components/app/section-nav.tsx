"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SectionNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

type SectionNavProps = {
  items: SectionNavItem[];
  className?: string;
};

export function SectionNav({ items, className }: SectionNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("w-full overflow-x-auto", className)} aria-label="Section navigation">
      <ul className="inline-flex min-w-max items-center gap-1 rounded-lg border bg-muted/40 p-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                {Icon ? <Icon className="size-4" /> : null}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

