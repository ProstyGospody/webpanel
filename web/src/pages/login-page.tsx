import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { APIError, apiFetch } from "@/services/api";

type LoginFormValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  useEffect(() => {
    let disposed = false;
    async function bootstrap() {
      try {
        await apiFetch<{ id: string }>("/api/auth/me", { method: "GET" });
        if (!disposed) navigate(redirectTo, { replace: true });
      } catch {
        if (!disposed) setChecking(false);
      }
    }
    void bootstrap();
    return () => {
      disposed = true;
    };
  }, [navigate, redirectTo]);

  const submit = handleSubmit(async ({ email, password }) => {
    setError("");
    try {
      await apiFetch<{ csrf_token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Login failed");
    }
  });

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
                <TextField
                  label="Admin email"
                  type="email"
                  required
                  fullWidth
                  autoComplete="username"
                  {...register("email", { required: true })}
                />
                <TextField
                  label="Password"
                  type="password"
                  required
                  fullWidth
                  autoComplete="current-password"
                  {...register("password", { required: true })}
                />
                <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
