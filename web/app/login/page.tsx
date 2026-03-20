"use client";

import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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
        <Typography color="text.secondary">Checking existing session...</Typography>
      </Stack>
    );
  }

  return (
    <Container maxWidth="md" sx={{ minHeight: "100vh", display: "grid", alignItems: "center", py: 3 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2.2, md: 3 } }}>
        <Grid container spacing={2.4}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5} sx={{ height: "100%", justifyContent: "center" }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <BoltRoundedIcon fontSize="small" />
                </Box>
                <Stack spacing={0.2}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Hysteria Control
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Administrative panel
                  </Typography>
                </Stack>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Secure sign-in for server management, client lifecycle operations, and runtime monitoring.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip icon={<ShieldRoundedIcon />} label="Session security" size="small" variant="outlined" />
                <Chip label="Live operations" size="small" variant="outlined" />
              </Stack>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Box component="form" onSubmit={submit}>
              <Stack spacing={1.5}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <TextField
                  label="Admin email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button type="submit" variant="contained" size="large" disabled={busy}>
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
