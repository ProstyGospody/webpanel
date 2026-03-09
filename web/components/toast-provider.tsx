"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useMemo } from "react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";

type ToastTone = "success" | "error" | "info";

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const push = useCallback((message: string, tone: ToastTone = "info") => {
    if (tone === "success") {
      toast.success(message);
      return;
    }

    if (tone === "error") {
      toast.error(message);
      return;
    }

    toast(message);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster position="bottom-right" closeButton richColors />
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

