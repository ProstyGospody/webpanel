"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Admin } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { useTheme } from "@/components/theme-provider";

type NavSection = {
  title: string;
  items: Array<{ href: string; label: string }>;
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Hysteria 2",
    items: [
      { href: "/hysteria/users", label: "Users" },
      { href: "/hysteria/settings", label: "Settings" },
    ],
  },
  {
    title: "MTProxy",
    items: [
      { href: "/mtproxy/users", label: "Users" },
      { href: "/mtproxy/settings", label: "Settings" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/services", label: "Services" },
      { href: "/audit", label: "Audit" },
    ],
  },
];

function normalizePathname(pathname: string): string {
  if (pathname === "/hysteria") {
    return "/hysteria/users";
  }
  if (pathname === "/mtproxy") {
    return "/mtproxy/users";
  }
  return pathname;
}

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = normalizePathname(usePathname());
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
        <div className="card card-muted max-w-md">
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

  const renderNav = (onNavigate?: () => void) => (
    <div className="nav-sections">
      {navSections.map((section) => (
        <section key={section.title} className="nav-section">
          <div className="nav-section-title">{section.title}</div>
          <div className="nav-links">
            {section.items.map((item) => {
              const active = isActiveLink(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "nav-link-active" : ""}`}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div className="sidebar-brand">
          <div className="brand-title">Proxy Panel</div>
          <div className="brand-subtitle">Hysteria 2 + MTProxy</div>
        </div>
        {renderNav()}
        <div className="sidebar-footer text-xs text-muted">{admin?.email || "admin"}</div>
      </aside>

      <div className="shell-workspace">
        <header className="shell-topbar">
          <div className="shell-topbar-left">
            <button className="btn btn-ghost mobile-only" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              Menu
            </button>
            <div className="topbar-title">Control plane</div>
            <div className="topbar-subtitle">Single-node Debian 12 operations</div>
          </div>
          <div className="shell-topbar-right">
            <button className="btn btn-ghost" onClick={onThemeToggle} disabled={!ready}>
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button className="btn btn-ghost" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="app-main">{children}</main>
      </div>

      {mobileNavOpen && (
        <>
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
          <aside className="mobile-nav-panel" aria-label="Mobile navigation">
            <div className="mobile-nav-header">
              <div className="font-semibold">Navigation</div>
              <button className="btn btn-ghost" onClick={() => setMobileNavOpen(false)}>
                Close
              </button>
            </div>
            {renderNav(() => setMobileNavOpen(false))}
            <div className="mobile-nav-footer text-xs text-muted">{admin?.email || "admin"}</div>
          </aside>
        </>
      )}
    </div>
  );
}
