"use client";

import { cn, MaterialIcon } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MenuItem = {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type OverflowMenuProps = {
  ariaLabel?: string;
  items: MenuItem[];
};

export function OverflowMenu({ ariaLabel = "More actions", items }: OverflowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />} aria-label={ariaLabel}>
        <MaterialIcon name="more_vert" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled}
            variant={item.danger ? "destructive" : "default"}
            onClick={item.onSelect}
            className={cn("gap-2")}
          >
            {item.icon && <MaterialIcon name={item.icon} className="size-4" />}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

