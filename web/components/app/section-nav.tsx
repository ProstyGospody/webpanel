"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
      <ul className="inline-flex min-w-max items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
                  "h-8 rounded-md",
                  active && "shadow-sm"
                )}
              >
                {Icon && <Icon className="size-4" />}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

