"use client";

import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { APIError, apiFetch } from "@/lib/api";

type SessionState = "loading" | "ready";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>("loading");

  const isLoginPath = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    let disposed = false;

    async function verify() {
      if (isLoginPath) {
        setState("ready");
        return;
      }
      try {
        await apiFetch<{ id: string }>("/api/auth/me", { method: "GET" });
        if (!disposed) {
          setState("ready");
        }
      } catch (err) {
        if (err instanceof APIError && err.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/login");
      }
    }

    void verify();
    return () => {
      disposed = true;
    };
  }, [isLoginPath, router]);

  if (state !== "ready") {
    return (
      <Stack sx={{ minHeight: "100vh" }} alignItems="center" justifyContent="center" spacing={2}>
        <CircularProgress color="primary" />
        <Typography variant="body2" color="text.secondary">
          Checking session...
        </Typography>
      </Stack>
    );
  }

  return <Box>{children}</Box>;
}
