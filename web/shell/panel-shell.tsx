"use client";

import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { ReactNode, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch } from "@/services/api";

type NavItem = { href: string; label: string; icon: ReactNode };

const drawerWidth = 280;
const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: <DashboardRoundedIcon /> },
  { href: "/users", label: "Clients", icon: <GroupRoundedIcon /> },
  { href: "/config", label: "Server", icon: <TuneRoundedIcon /> },
  { href: "/services", label: "Services", icon: <SettingsEthernetRoundedIcon /> },
  { href: "/audit", label: "Audit", icon: <ReceiptLongRoundedIcon /> },
];

function resolveTitle(pathname: string): string {
  if (pathname === "/") return "Hysteria 2";
  return navItems.find((x) => x.href === pathname)?.label || "Panel";
}

export function PanelShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeTitle = useMemo(() => resolveTitle(pathname), [pathname]);

  async function logout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // no-op
    }
    router.replace("/login");
  }

  const drawerContent = (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText", width: 38, height: 38 }}>
            <BoltRoundedIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Hysteria 2</Typography>
            <Typography variant="caption" color="text.secondary">Admin Panel</Typography>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <List sx={{ px: 1.25, py: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => {
          const selected = pathname === item.href;
          return (
            <ListItemButton
              key={item.href}
              selected={selected}
              onClick={() => {
                router.push(item.href);
                setMobileOpen(false);
              }}
              sx={(theme) => ({
                mb: 0.5,
                borderRadius: 2,
                "&.Mui-selected": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.16),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                },
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
              })}
            >
              <ListItemIcon sx={{ minWidth: 38, color: selected ? "primary.light" : "text.secondary" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: 1.5 }}>
        <ListItemButton onClick={logout} sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 38 }}><LogoutRoundedIcon /></ListItemIcon>
          <ListItemText primary="Sign out" />
        </ListItemButton>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={(theme) => ({
          backdropFilter: "blur(10px)",
          bgcolor: alpha(theme.palette.background.default, 0.9),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          width: desktop ? `calc(100% - ${drawerWidth}px)` : "100%",
          ml: desktop ? `${drawerWidth}px` : 0,
        })}
      >
        <Toolbar sx={{ gap: 1 }}>
          {!desktop ? (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)}><MenuRoundedIcon /></IconButton>
          ) : null}
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>{activeTitle}</Typography>
          <Tooltip title="Sign out">
            <IconButton color="inherit" onClick={logout}><LogoutRoundedIcon /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={desktop ? "permanent" : "temporary"}
        open={desktop ? true : mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={(theme) => ({
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`,
          },
        })}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: "100%" }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
