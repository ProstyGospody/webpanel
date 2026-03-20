"use client";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { ReactNode, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch } from "@/services/api";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
};

type PageMeta = { title: string; subtitle: string };

const drawerWidth = 292;
const navItems: NavItem[] = [
  { href: "/", label: "Overview", description: "Runtime health and traffic", icon: <DashboardRoundedIcon /> },
  { href: "/users", label: "Clients", description: "Access lifecycle and artifacts", icon: <GroupRoundedIcon /> },
  { href: "/config", label: "Server", description: "Hysteria configuration", icon: <TuneRoundedIcon /> },
  { href: "/services", label: "Services", description: "Systemd process operations", icon: <SettingsEthernetRoundedIcon /> },
  { href: "/audit", label: "Audit", description: "Administrative activity trail", icon: <ReceiptLongRoundedIcon /> },
];

function pageMeta(pathname: string): PageMeta {
  if (pathname === "/") {
    return { title: "Server Overview", subtitle: "Live network and service operations" };
  }
  const active = navItems.find((item) => item.href === pathname);
  if (!active) {
    return { title: "Panel", subtitle: "Operations workspace" };
  }
  return { title: active.label, subtitle: active.description };
}

export function PanelShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = useMemo(() => pageMeta(pathname), [pathname]);

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
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.4}>
          <Avatar
            variant="rounded"
            sx={{
              width: 38,
              height: 38,
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: "primary.light",
              borderRadius: 1.5,
            }}
          >
            <BoltRoundedIcon fontSize="small" />
          </Avatar>
          <Stack spacing={0.1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Hysteria Control
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Operational panel
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ px: 1.5, py: 1.5, flexGrow: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 1.5, pb: 1, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Navigation
        </Typography>
        <List disablePadding>
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
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  alignItems: "flex-start",
                  border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.5) : "transparent"}`,
                  backgroundColor: selected ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    mt: 0.2,
                    color: selected ? "primary.light" : "text.secondary",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 600, fontSize: "0.92rem" }}
                  secondaryTypographyProps={{ fontSize: "0.76rem", lineHeight: 1.3 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Box sx={{ px: 2, py: 2 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            backgroundColor: alpha(theme.palette.background.default, 0.44),
            borderColor: alpha(theme.palette.divider, 0.9),
          }}
        >
          <Stack spacing={1.2}>
            <Chip size="small" label="Session active" color="success" variant="outlined" sx={{ width: "fit-content" }} />
            <Button
              onClick={logout}
              color="inherit"
              startIcon={<LogoutRoundedIcon fontSize="small" />}
              sx={{
                justifyContent: "flex-start",
                borderRadius: 1.5,
                px: 1.25,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              Sign out
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: desktop ? `calc(100% - ${drawerWidth}px)` : "100%",
          ml: desktop ? `${drawerWidth}px` : 0,
        }}
      >
        <Toolbar sx={{ minHeight: 68, gap: 1.5 }}>
          {!desktop ? (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)}>
              <MenuRoundedIcon />
            </IconButton>
          ) : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {meta.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {meta.subtitle}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            icon={<BoltRoundedIcon />}
            label="Live control"
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          />
        </Toolbar>
      </AppBar>

      <Drawer
        variant={desktop ? "permanent" : "temporary"}
        open={desktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar sx={{ minHeight: 68 }} />
        <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
