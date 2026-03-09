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
    <nav className="md-tabs" aria-label="Section navigation">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={cn("md-tab", active && "md-tab--active")}> 
            {item.icon && <MaterialIcon name={item.icon} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

