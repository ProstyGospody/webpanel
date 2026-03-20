"use client";

import {
  AppBar,
  Avatar,
  Box,
  Button,
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
      <Toolbar sx={{ px: 2.25, minHeight: "76px !important" }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            sx={(theme) => ({
              width: 38,
              height: 38,
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: theme.palette.primary.light,
            })}
          >
            <BoltRoundedIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Hysteria 2</Typography>
            <Typography variant="caption" color="text.secondary">Admin Panel</Typography>
          </Box>
        </Stack>
      </Toolbar>
      <Divider sx={{ borderColor: (theme) => alpha(theme.palette.divider, 0.6) }} />
      <List sx={{ px: 1.5, py: 1.5, flexGrow: 1 }}>
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
                mb: 0.4,
                borderRadius: 2.25,
                minHeight: 44,
                px: 1.35,
                color: selected ? theme.palette.text.primary : theme.palette.text.secondary,
                "&.Mui-selected": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.18),
                  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.45)}`,
                  color: theme.palette.text.primary,
                },
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
              })}
            >
              <ListItemIcon sx={{ minWidth: 36, color: selected ? "primary.light" : "text.secondary" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: 1.5, pt: 0.5 }}>
        <Button
          variant="text"
          color="inherit"
          fullWidth
          onClick={logout}
          startIcon={<LogoutRoundedIcon />}
          sx={(theme) => ({
            justifyContent: "flex-start",
            borderRadius: 2.25,
            color: theme.palette.text.secondary,
            px: 1.35,
            py: 1,
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.text.primary,
            },
          })}
        >
          Sign out
        </Button>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={(theme) => ({
          backdropFilter: "blur(14px)",
          backgroundImage: "none",
          bgcolor: alpha(theme.palette.background.default, 0.84),
          border: 0,
          borderBottom: 0,
          borderRadius: 0,
          boxShadow: `inset 0 -1px 0 ${alpha(theme.palette.primary.main, 0.2)}`,
          width: desktop ? `calc(100% - ${drawerWidth}px)` : "100%",
          ml: desktop ? `${drawerWidth}px` : 0,
        })}
      >
        <Toolbar sx={{ gap: 1, minHeight: "76px !important", px: { xs: 1.25, sm: 2.5 } }}>
          {!desktop ? (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)}><MenuRoundedIcon /></IconButton>
          ) : null}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeTitle}</Typography>
          </Box>
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
            border: 0,
            borderRight: 0,
            borderRadius: 0,
            boxShadow: `inset -1px 0 0 ${alpha(theme.palette.primary.main, 0.2)}`,
            backgroundImage: "none",
            backgroundColor: alpha(theme.palette.background.paper, 0.96),
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
