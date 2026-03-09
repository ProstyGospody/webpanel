"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Admin } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { useTheme } from "@/components/theme-provider";
import { Button, IconButton, MaterialIcon, cn } from "@/components/ui";

type Destination = {
  href: string;
  label: string;
  icon: string;
};

const destinations: Destination[] = [
  { href: "/", label: "Dashboard", icon: "space_dashboard" },
  { href: "/clients", label: "Clients", icon: "group" },
  { href: "/hysteria", label: "Hysteria 2", icon: "bolt" },
  { href: "/mtproxy", label: "MTProxy", icon: "vpn_key" },
  { href: "/services", label: "Services", icon: "dns" },
  { href: "/audit", label: "Audit", icon: "history" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function normalizePathname(pathname: string): string {
  if (pathname === "/hysteria/users" || pathname === "/hysteria/settings") {
    return "/hysteria";
  }
  if (pathname === "/mtproxy/users" || pathname === "/mtproxy/settings") {
    return "/mtproxy";
  }
  return pathname;
}

function isActiveDestination(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageSubtitle(pathname: string): string {
  if (pathname.startsWith("/hysteria")) {
    return "Hysteria runtime and account control";
  }
  if (pathname.startsWith("/mtproxy")) {
    return "MTProxy secrets and runtime context";
  }
  if (pathname.startsWith("/services")) {
    return "Systemd operations and log diagnostics";
  }
  if (pathname.startsWith("/audit")) {
    return "Administrative history and change trace";
  }
  if (pathname.startsWith("/settings")) {
    return "Panel and protocol configuration";
  }
  if (pathname.startsWith("/clients")) {
    return "Client identities and access lifecycle";
  }
  return "Single-node Debian 12 operations";
}

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = normalizePathname(rawPathname);

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
    if (!mobileNavOpen) {
      return;
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    }

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [mobileNavOpen]);

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
  }, [isPublic, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="app-shell" style={{ display: "grid", placeItems: "center", padding: 16 }}>
        <section className="md-card md-card--outlined" style={{ width: "min(420px, 100%)" }}>
          <div className="md-card__content" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="md-circular-progress" aria-hidden />
            <span>Loading admin session...</span>
          </div>
        </section>
      </div>
    );
  }

  const currentDestination = destinations.find((item) => isActiveDestination(pathname, item.href)) || destinations[0];

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

  const drawerItems = (
    <div className="md-destination-list">
      {destinations.map((item) => {
        const active = isActiveDestination(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className={cn("md-nav-item", active && "md-nav-item--active")}>
            <span className="md-nav-item__icon">
              <MaterialIcon name={item.icon} filled={active} />
            </span>
            <span className="md-nav-item__label">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <>
          <div className="md-modal-scrim" onClick={() => setMobileNavOpen(false)} />
          <aside className="md-modal-drawer" aria-label="Navigation drawer">
            <div className="md-modal-drawer__header">
              <div className="md-nav-brand__title">Navigation</div>
              <IconButton icon="close" label="Close navigation" onClick={() => setMobileNavOpen(false)} />
            </div>
            {drawerItems}
            <div className="md-modal-drawer__footer">{admin?.email || "admin"}</div>
          </aside>
        </>
      )}

      <div className="md-scaffold">
        <aside className="md-navigation-drawer" aria-label="Primary destinations">
          <div className="md-nav-brand">
            <h1 className="md-nav-brand__title">Proxy Panel</h1>
            <p className="md-nav-brand__subtitle">Hysteria 2 + MTProxy</p>
          </div>
          {drawerItems}
          <div className="md-nav-footer">{admin?.email || "admin"}</div>
        </aside>

        <aside className="md-navigation-rail" aria-label="Primary destinations">
          {destinations.map((item) => {
            const active = isActiveDestination(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("md-rail-item", active && "md-rail-item--active")}>
                <span className="md-rail-item__icon">
                  <MaterialIcon name={item.icon} filled={active} />
                </span>
                <span className="md-rail-item__label">{item.label}</span>
              </Link>
            );
          })}
        </aside>

        <div className="md-scaffold-main">
          <header className="md-top-app-bar">
            <div className="md-top-app-bar__leading">
              <IconButton
                className="md-only-compact"
                icon="menu"
                label="Open navigation"
                onClick={() => setMobileNavOpen(true)}
              />
              <div>
                <p className="md-top-app-bar__title">{currentDestination.label}</p>
                <p className="md-top-app-bar__subtitle">{getPageSubtitle(pathname)}</p>
              </div>
            </div>

            <div className="md-top-app-bar__actions">
              <IconButton
                icon={theme === "dark" ? "light_mode" : "dark_mode"}
                label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={onThemeToggle}
                disabled={!ready}
              />
              <Button variant="text" icon="logout" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </header>

          <main className="md-content">{children}</main>
        </div>
      </div>
    </div>
  );
}

