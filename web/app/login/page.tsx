"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import { Button, InlineMessage, TextField } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch<{ csrf_token: string }>("/api/auth/login", {
        method: "POST",
        body: toJSONBody({ email, password }),
      });
      router.replace("/");
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="md-auth-shell">
      <section className="md-auth-card" aria-labelledby="login-title">
        <h1 id="login-title" className="md-auth-title">Proxy Panel Login</h1>
        <p className="md-auth-subtitle">Sign in with admin account credentials.</p>

        {error && <InlineMessage tone="error">{error}</InlineMessage>}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </div>
  );
}

