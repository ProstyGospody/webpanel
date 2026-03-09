"use client";

import { useEffect, useRef, useState } from "react";

import { cn, IconButton, MaterialIcon } from "@/components/ui";

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
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!anchorRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="md-menu-anchor" ref={anchorRef}>
      <IconButton
        icon="more_vert"
        label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      />

      {open && (
        <div className="md-menu" role="menu" aria-label={ariaLabel}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cn("md-menu__item", item.danger && "md-menu__item--danger")}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              disabled={item.disabled}
            >
              {item.icon && <MaterialIcon name={item.icon} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

