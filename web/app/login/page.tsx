"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";

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
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="mb-2 text-xl font-semibold">Proxy Panel Login</h1>
        <p className="mb-4 text-sm text-muted">Sign in with admin account</p>

        {error && <div className="mb-3 alert alert-error">{error}</div>}

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm">Email</span>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button disabled={loading} className="btn btn-primary w-full" type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

