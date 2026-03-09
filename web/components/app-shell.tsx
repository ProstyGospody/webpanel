"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, PropsWithChildren, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";

import { APIError, apiFetch, toJSONBody } from "@/lib/api";
import type { Admin } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CircularProgress, cn } from "@/components/ui";

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

const sections: NavigationSection[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Protocols",
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/hysteria/users", label: "Hysteria Users", icon: Zap },
      { href: "/hysteria/settings", label: "Hysteria Settings", icon: Settings },
      { href: "/mtproxy/users", label: "MTProxy Users", icon: KeyRound },
      { href: "/mtproxy/settings", label: "MTProxy Settings", icon: Settings },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/services", label: "Services", icon: Activity },
      { href: "/audit", label: "Audit", icon: ShieldCheck },
    ],
  },
  {
    title: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

function isActivePath(pathname: string, item: NavigationItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function normalizePathname(pathname: string): string {
  if (pathname === "/hysteria") {
    return "/hysteria/users";
  }

  if (pathname === "/mtproxy") {
    return "/mtproxy/users";
  }

  return pathname;
}

function useBreadcrumb(pathname: string) {
  const map = useMemo(
    () => ({
      "/": ["Dashboard"],
      "/clients": ["Clients"],
      "/clients/[id]": ["Clients", "Details"],
      "/hysteria/users": ["Hysteria 2", "Users"],
      "/hysteria/settings": ["Hysteria 2", "Settings"],
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

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = normalizePathname(rawPathname);

  const breadcrumbs = useBreadcrumb(pathname);
  const { push } = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<Admin | null>(null);

  const isPublic = pathname === "/login";

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

  if (isPublic) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <CircularProgress />
          Loading admin session...
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/" />}
                className="group-data-[collapsible=icon]:!p-2"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Proxy Panel</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Hysteria 2 + MTProxy</span>
                </div>
                <Badge variant="outline" className="text-[10px] group-data-[collapsible=icon]:hidden">
                  v1
                </Badge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {sections.map((section) => (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item);
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>

              {section.title === "Protocols" && (
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/hysteria/users" />} isActive={pathname.startsWith("/hysteria")}>
                      Hysteria 2
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/mtproxy/users" />} isActive={pathname.startsWith("/mtproxy")}>
                      MTProxy
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              )}
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium">{admin?.email || "admin"}</p>
            <p className="text-xs text-sidebar-foreground/70">Authenticated session</p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="shrink-0" />
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
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Signed in as</span>
                    <span className="truncate text-sm font-medium">{admin?.email || "admin"}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="size-4" />
                  Appearance & Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} variant="destructive">
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className={cn("mx-auto w-full max-w-7xl p-4 sm:p-6")}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}


