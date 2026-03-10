import { NextRequest, NextResponse } from "next/server";

import { loadDashboardMetrics } from "@/lib/metrics/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_INTERNAL_URL = resolveApiInternalUrl();
const AUTH_TIMEOUT_MS = 1500;

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authCheck = await verifySession(cookieHeader);
  if (authCheck.status === 401 || authCheck.status === 403) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authCheck.status >= 500) {
    return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
  }

  try {
    const payload = await loadDashboardMetrics();
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to collect dashboard metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function verifySession(cookieHeader: string): Promise<{ status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_INTERNAL_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    return { status: response.status };
  } catch {
    return { status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveApiInternalUrl(): string {
  const explicit = (process.env.PANEL_API_INTERNAL_URL || "").trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const listenAddr = (process.env.PANEL_API_LISTEN_ADDR || "").trim();
  if (listenAddr) {
    const normalized = listenAddr.startsWith(":") ? `127.0.0.1${listenAddr}` : listenAddr;
    return `http://${normalized}`.replace(/\/$/, "");
  }

  return "http://127.0.0.1:18080";
}
