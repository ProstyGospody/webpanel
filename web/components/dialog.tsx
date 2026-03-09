"use client";

import { PropsWithChildren, ReactNode, useEffect, useId, useRef } from "react";

import { Button, cn } from "@/components/ui";

type DialogSize = "sm" | "md" | "lg";

type DialogProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  actions?: ReactNode;
  size?: DialogSize;
}>;

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  );
}

export function Dialog({ open, title, description, onClose, actions, size = "md", children }: DialogProps) {
  const titleID = useId();
  const descID = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActive = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] || panel).focus();
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panel) {
        return;
      }

      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = originalOverflow;
      previousActive?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="md-dialog-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn("md-dialog", size === "sm" && "md-dialog--sm", size === "lg" && "md-dialog--lg")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleID}
        aria-describedby={description ? descID : undefined}
        tabIndex={-1}
      >
        <h2 id={titleID} className="md-dialog__headline">{title}</h2>
        <div className="md-dialog__content">
          {description && (
            <p id={descID} style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)", fontSize: "0.95rem" }}>
              {description}
            </p>
          )}
          {children}
        </div>
        {actions && <footer className="md-dialog__actions">{actions}</footer>}
      </div>
    </>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  busy = false,
  danger = true,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      size="sm"
      actions={
        <>
          <Button variant="text" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "filled"} type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

