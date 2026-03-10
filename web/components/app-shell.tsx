"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type PropsWithChildren, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sun,
  User,
  Waves,
  Wrench,
} from "lucide-react";
import { useTheme } from "next-themes";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Admin } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

const SIDEBAR_STORAGE_KEY = "pp_sidebar_collapsed";

const sections: NavigationSection[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Hysteria",
    items: [
      { href: "/hysteria/users", label: "Users", icon: Waves },
      { href: "/hysteria/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "MTProxy",
    items: [
      { href: "/mtproxy/users", label: "Users", icon: KeyRound },
      { href: "/mtproxy/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/services", label: "Services", icon: Wrench },
      { href: "/audit", label: "Audit", icon: ShieldCheck },
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

function isActivePath(pathname: string, item: NavigationItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function useBreadcrumb(pathname: string) {
  const map = useMemo(
    () => ({
      "/": ["Dashboard"],
      "/clients": ["Clients"],
      "/clients/[id]": ["Clients", "Details"],
      "/hysteria/users": ["Hysteria", "Users"],
      "/hysteria/settings": ["Hysteria", "Settings"],
      "/mtproxy/users": ["MTProxy", "Users"],
      "/mtproxy/settings": ["MTProxy", "Settings"],
      "/services": ["Services"],
      "/audit": ["Audit"],
      "/settings": ["Settings"],
    }),
    []
  );

  if (pathname.startsWith("/clients/") && pathname !== "/clients") {
    return map["/clients/[id]"];
  }

  return map[pathname as keyof typeof map] || ["Panel"];
}

type ShellNavigationProps = {
  pathname: string;
  collapsed: boolean;
  adminEmail: string;
  onNavigate?: () => void;
};

function ShellNavigation({ pathname, collapsed, adminEmail, onNavigate }: ShellNavigationProps) {
  return (
    <>
      <div className="flex h-14 items-center border-b px-3">
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-lg text-sm font-semibold text-sidebar-foreground transition-colors hover:text-sidebar-foreground/80",
            collapsed && "w-full justify-center"
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" />
          </div>
          {!collapsed && (
            <>
              <span className="truncate">Proxy Panel</span>
              <Badge variant="outline" className="h-5 text-[10px]">
                v1
              </Badge>
            </>
          )}
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Primary navigation">
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="space-y-1">
              {!collapsed && <p className="px-2 text-xs font-medium text-sidebar-foreground/70">{section.title}</p>}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item);
                  const Icon = item.icon;

                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        buttonVariants({ variant: active ? "secondary" : "ghost", size: collapsed ? "icon" : "sm" }),
                        "w-full rounded-lg text-sidebar-foreground",
                        collapsed ? "justify-center" : "justify-start"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );

                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger render={link} />
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t p-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2"
                />
              }
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[11px]">AD</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right">{adminEmail}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2">
            <p className="truncate text-xs font-medium">{adminEmail}</p>
            <p className="text-xs text-sidebar-foreground/70">Authenticated session</p>
          </div>
        )}
      </div>
    </>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = normalizePathname(rawPathname);
  const isMobile = useIsMobile();

  const breadcrumbs = useBreadcrumb(pathname);
  const { push } = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPublic = pathname === "/login";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setDesktopCollapsed(saved === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        if (isMobile) {
          setMobileOpen((open) => !open);
        } else {
          setDesktopCollapsed((collapsed) => !collapsed);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile]);

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

  function toggleTheme() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    push(`Theme switched to ${next}`, "info");
  }

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }

    setDesktopCollapsed((collapsed) => !collapsed);
  }

  if (isPublic) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading admin session...
        </div>
      </div>
    );
  }

  const adminEmail = admin?.email || "admin";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh w-full">
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex",
            desktopCollapsed ? "w-[4.5rem]" : "w-72"
          )}
        >
          <ShellNavigation pathname={pathname} collapsed={desktopCollapsed} adminEmail={adminEmail} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground sm:max-w-72">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Primary application navigation.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <ShellNavigation
                pathname={pathname}
                collapsed={false}
                adminEmail={adminEmail}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-h-svh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={toggleSidebar}
                aria-label={isMobile ? "Open navigation" : desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isMobile ? (
                  <Menu className="size-4" />
                ) : desktopCollapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => {
                    const last = index === breadcrumbs.length - 1;

                    return (
                      <div key={`${item}-${index}`} className="flex items-center">
                        <BreadcrumbItem>
                          <BreadcrumbPage>{item}</BreadcrumbPage>
                        </BreadcrumbItem>
                        {!last && (
                          <BreadcrumbSeparator>
                            <ChevronRight className="size-3.5" />
                          </BreadcrumbSeparator>
                        )}
                      </div>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={toggleTheme}
                aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 gap-2 px-2" />}>
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[11px]">AD</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm md:inline">Admin</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Signed in as</span>
                        <span className="truncate text-sm font-medium">{adminEmail}</span>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <User className="size-4" />
                    Profile & Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout} variant="destructive">
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

