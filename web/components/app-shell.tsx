"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Admin } from "@/lib/types";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/hysteria", label: "Hysteria 2" },
  { href: "/mtproxy", label: "MTProxy" },
  { href: "/services", label: "Services" },
  { href: "/audit", label: "Audit" },
];

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<Admin | null>(null);

  const isPublic = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    let cancelled = false;
    if (isPublic) {
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<Admin>("/api/auth/me")
      .then((me) => {
        if (!cancelled) {
          setAdmin(me);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof APIError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPublic, pathname, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-700">Loading admin session...</div>;
  }

  async function onLogout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
        body: toJSONBody({}),
      });
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-panel-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="text-base font-semibold">Proxy Panel</div>
            <nav className="flex flex-wrap gap-1 text-sm">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded px-2 py-1 ${active ? "bg-blue-100 text-blue-900" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{admin?.email || "admin"}</span>
            <button className="btn btn-muted" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
