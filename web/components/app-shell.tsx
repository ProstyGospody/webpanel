"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Admin } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { useTheme } from "@/components/theme-provider";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/hysteria", label: "Hysteria 2" },
  { href: "/mtproxy", label: "MTProxy" },
  { href: "/services", label: "Services" },
  { href: "/audit", label: "Audit" },
];

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { push } = useToast();
  const { theme, toggleTheme, ready } = useTheme();

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isPublic = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
    return (
      <div className="shell-loading">
        <div className="card max-w-md">
          <div className="text-sm text-muted">Loading admin session...</div>
        </div>
      </div>
    );
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

  function onThemeToggle() {
    const next = toggleTheme();
    push(`Theme changed: ${next}`, "info");
  }

  const renderNavLinks = (isMobile = false) => (
    <>
      {nav.map((item) => {
        const active = isActiveLink(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${active ? "nav-link-active" : ""} ${isMobile ? "nav-link-mobile" : ""}`}
            onClick={() => isMobile && setMobileNavOpen(false)}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-left">
            <button className="btn btn-muted md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              Menu
            </button>
            <div className="brand-block">
              <div className="brand-title">Proxy Panel</div>
              <div className="brand-subtitle">Hysteria 2 and MTProxy control</div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {renderNavLinks(false)}
          </nav>

          <div className="app-header-right">
            <button className="btn btn-muted" onClick={onThemeToggle} disabled={!ready}>
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="hidden text-sm text-muted sm:inline">{admin?.email || "admin"}</span>
            <button className="btn btn-muted" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <>
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
          <aside className="mobile-nav-panel" aria-label="Mobile navigation">
            <div className="mobile-nav-header">
              <div className="text-sm font-semibold">Navigation</div>
              <button className="btn btn-muted" onClick={() => setMobileNavOpen(false)}>
                Close
              </button>
            </div>
            <div className="mobile-nav-links">{renderNavLinks(true)}</div>
            <div className="mobile-nav-footer">
              <div className="text-xs text-muted">{admin?.email || "admin"}</div>
              <div className="flex gap-2">
                <button className="btn btn-muted" onClick={onThemeToggle}>
                  {theme === "dark" ? "Light" : "Dark"}
                </button>
                <button className="btn btn-muted" onClick={onLogout}>
                  Logout
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      <main className="app-main">{children}</main>
    </div>
  );
}

