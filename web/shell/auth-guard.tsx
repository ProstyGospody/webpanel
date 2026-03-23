import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { APIError, apiFetch } from "@/services/api";

export function AuthGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => apiFetch<{ id: string }>("/api/auth/me", { method: "GET" }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!sessionQuery.isError) {
      return;
    }

    const target = location.pathname + location.search + location.hash;
    const error = sessionQuery.error;
    if (error instanceof APIError && error.status === 401) {
      navigate("/login", { replace: true, state: { from: target } });
      return;
    }
    navigate("/login", { replace: true, state: { from: target } });
  }, [location.hash, location.pathname, location.search, navigate, sessionQuery.error, sessionQuery.isError]);

  if (sessionQuery.isPending || sessionQuery.isError) {
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
