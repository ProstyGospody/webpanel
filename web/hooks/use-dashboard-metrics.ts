"use client";

import { useEffect, useRef, useState } from "react";

import type { DashboardMetricsDto } from "@/lib/dashboard/types";

const FALLBACK_REFRESH_MS = 10_000;

type DashboardState = {
  data: DashboardMetricsDto | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

export function useDashboardMetrics() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
  });

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const refreshMsRef = useRef<number>(FALLBACK_REFRESH_MS);

  useEffect(() => {
    let cancelled = false;

    const schedule = (ms: number) => {
      if (cancelled) {
        return;
      }

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        void poll(false);
      }, ms);
    };

    const poll = async (initial: boolean) => {
      if (cancelled) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({
        ...prev,
        loading: initial && !prev.data,
        refreshing: !initial,
      }));

      try {
        const payload = await fetchDashboardMetrics(controller.signal);
        if (cancelled) {
          return;
        }

        refreshMsRef.current = payload.refreshIntervalMs || FALLBACK_REFRESH_MS;

        setState((prev) => ({
          ...prev,
          data: payload,
          loading: false,
          refreshing: false,
          error: null,
        }));

        schedule(refreshMsRef.current);
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load dashboard metrics";

        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: message,
        }));

        schedule(refreshMsRef.current);
      }
    };

    void poll(true);

    return () => {
      cancelled = true;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      abortRef.current?.abort();
    };
  }, []);

  return state;
}

async function fetchDashboardMetrics(signal: AbortSignal): Promise<DashboardMetricsDto> {
  const response = await fetch("/bff/dashboard", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    const payload = (await safeParseJSON(response)) as { error?: string } | null;
    throw new Error(payload?.error || `Dashboard request failed (${response.status})`);
  }

  return (await response.json()) as DashboardMetricsDto;
}

async function safeParseJSON(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
