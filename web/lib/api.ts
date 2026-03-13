export class APIError extends Error {
  status: number;
  errorType?: string;
  details?: unknown;

  constructor(status: number, message: string, options?: { errorType?: string; details?: unknown }) {
    super(message);
    this.status = status;
    this.errorType = options?.errorType;
    this.details = options?.details;
  }
}

function getCookie(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value || "");
    }
  }
  return "";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    const csrf = getCookie("pp_csrf");
    if (csrf && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  let payload: any = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new APIError(response.status, message, {
      errorType: payload?.error_type,
      details: payload?.details,
    });
  }

  return payload as T;
}

export function toJSONBody<T extends Record<string, unknown>>(data: T): string {
  return JSON.stringify(data);
}
