"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";

import { MaterialIcon } from "@/components/ui";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push }), [push]);
  const toneIcon: Record<ToastTone, string> = {
    success: "check_circle",
    error: "error",
    info: "info",
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="md-snackbar-stack" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`md-snackbar md-snackbar--${item.tone}`}>
            <MaterialIcon name={toneIcon[item.tone]} />
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}

