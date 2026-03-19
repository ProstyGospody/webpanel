"use client";

import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { APIError, apiFetch } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let disposed = false;
    async function bootstrap() {
      try {
        await apiFetch<{ id: string }>("/api/auth/me", { method: "GET" });
        if (!disposed) router.replace("/");
      } catch {
        if (!disposed) setChecking(false);
      }
    }
    void bootstrap();
    return () => {
      disposed = true;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiFetch<{ csrf_token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <Stack sx={{ minHeight: "100vh" }} alignItems="center" justifyContent="center" spacing={2}>
        <CircularProgress />
        <Typography color="text.secondary">Loading...</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 430 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "primary.main", display: "grid", placeItems: "center", color: "primary.contrastText" }}>
                <BoltRoundedIcon />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Hysteria 2 Panel</Typography>
                <Typography variant="body2" color="text.secondary">Admin login</Typography>
              </Box>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box component="form" onSubmit={submit}>
              <Stack spacing={2}>
                <TextField label="Admin email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
                <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
                <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}


