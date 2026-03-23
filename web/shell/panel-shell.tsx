import {
  AppBar,
  Avatar,
  Box,
  Button,
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
import { alpha, type Theme, useTheme } from "@mui/material/styles";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { ReactNode, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiFetch } from "@/services/api";
import { useAppThemeMode } from "@/theme/app-theme-provider";

type NavItem = { href: string; label: string; icon: ReactNode };

const drawerWidth = 280;
const collapsedDrawerWidth = 86;
const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: <DashboardRoundedIcon /> },
  { href: "/users", label: "Users", icon: <GroupRoundedIcon /> },
  { href: "/config", label: "Server", icon: <TuneRoundedIcon /> },
  { href: "/audit", label: "Audit", icon: <ReceiptLongRoundedIcon /> },
];

function resolveTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  return navItems.find((x) => x.href === pathname)?.label || "Panel";
}

function isNavItemSelected(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PanelShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useTheme();
  const { mode, toggleMode } = useAppThemeMode();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const activeTitle = useMemo(() => resolveTitle(pathname), [pathname]);
  const topBarHeight = { xs: 54, sm: 58 };
  const topBarActionSx = (muiTheme: Theme) => ({
    width: 36,
    height: 36,
    color: muiTheme.palette.text.secondary,
    "&:hover": {
      color: muiTheme.palette.text.primary,
      backgroundColor: alpha(muiTheme.palette.primary.main, 0.08),
    },
  });
  const layoutDrawerWidth = desktop ? (desktopNavCollapsed ? collapsedDrawerWidth : drawerWidth) : 0;

  async function logout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // no-op
    }
    navigate("/login", { replace: true });
  }

  const drawerContent = (collapsed: boolean) => (
    <Stack sx={{ height: "100%" }}>
      <Toolbar
        sx={{
          px: collapsed ? 1.1 : 2.25,
          minHeight: "76px !important",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <Stack direction="row" spacing={collapsed ? 0 : 1.25} alignItems="center">
          <Avatar
            sx={(theme) => ({
              width: 38,
              height: 38,
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: theme.palette.mode === "light" ? theme.palette.primary.dark : theme.palette.primary.light,
            })}
          >
            <BoltRoundedIcon fontSize="small" />
          </Avatar>
          {collapsed ? null : (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Hysteria 2</Typography>
              <Typography variant="caption" color="text.secondary">Admin Panel</Typography>
            </Box>
          )}
        </Stack>
      </Toolbar>
      <List sx={{ px: collapsed ? 0.8 : 1.5, py: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => {
          const selected = isNavItemSelected(pathname, item.href);
          const itemButton = (
            <ListItemButton
              key={item.href}
              selected={selected}
              onClick={() => {
                navigate(item.href);
                setMobileOpen(false);
              }}
              sx={(theme) => ({
                mb: 0.4,
                borderRadius: 2.25,
                minHeight: 44,
                px: collapsed ? 0 : 1.35,
                justifyContent: collapsed ? "center" : "flex-start",
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
              <ListItemIcon
                sx={(theme) => ({
                  minWidth: collapsed ? 0 : 36,
                  color: selected
                    ? theme.palette.mode === "light"
                      ? theme.palette.primary.dark
                      : theme.palette.primary.light
                    : theme.palette.text.secondary,
                  justifyContent: "center",
                })}
              >
                {item.icon}
              </ListItemIcon>
              {collapsed ? null : <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }} />}
            </ListItemButton>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} title={item.label} placement="right">
                {itemButton}
              </Tooltip>
            );
          }

          return itemButton;
        })}
      </List>
      <Box sx={{ p: collapsed ? 1 : 1.5, pt: 0.5, display: "flex", justifyContent: "center" }}>
        {collapsed ? (
          <Tooltip title="Sign out" placement="right">
            <IconButton
              color="inherit"
              onClick={logout}
              sx={(theme) => ({
                color: theme.palette.text.secondary,
                borderRadius: 2.25,
                "&:hover": {
                  color: theme.palette.text.primary,
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              })}
            >
              <LogoutRoundedIcon />
            </IconButton>
          </Tooltip>
        ) : (
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
        )}
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={(theme) => ({
          backdropFilter: "none",
          backgroundImage: "none",
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: 0,
          borderBottom: 0,
          borderRadius: 0,
          boxShadow: [
            `inset 0 -1px 0 ${alpha(theme.palette.primary.main, 0.22)}`,
            `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.03)}`,
          ].join(","),
          width: desktop ? `calc(100% - ${layoutDrawerWidth}px)` : "100%",
          ml: desktop ? `${layoutDrawerWidth}px` : 0,
          transition: theme.transitions.create(["width", "margin-left"], {
            duration: theme.transitions.duration.shortest,
          }),
        })}
      >
        <Toolbar sx={{ gap: 1, minHeight: `${topBarHeight.xs}px`, px: { xs: 1.25, sm: 2.5 }, "@media (min-width:600px)": { minHeight: `${topBarHeight.sm}px` } }}>
          {desktop ? (
            <Tooltip title={desktopNavCollapsed ? "Expand menu" : "Collapse menu"}>
              <IconButton
                color="inherit"
                onClick={() => setDesktopNavCollapsed((value) => !value)}
                sx={topBarActionSx}
              >
                {desktopNavCollapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />}
              </IconButton>
            </Tooltip>
          ) : (
            <IconButton
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={topBarActionSx}
            >
              <MenuRoundedIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>{activeTitle}</Typography>
          </Box>
          <Tooltip title={mode === "dark" ? "Light theme" : "Dark theme"}>
            <IconButton
              color="inherit"
              onClick={toggleMode}
              sx={topBarActionSx}
            >
              {mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Sign out">
            <IconButton
              color="inherit"
              onClick={logout}
              sx={topBarActionSx}
            >
              <LogoutRoundedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {desktop ? (
        <Drawer
          variant="permanent"
          open
          sx={(theme) => ({
            width: layoutDrawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: layoutDrawerWidth,
              boxSizing: "border-box",
              border: 0,
              borderRight: 0,
              borderRadius: 0,
              boxShadow: `inset -1px 0 0 ${alpha(theme.palette.primary.main, 0.16)}`,
              backgroundImage: "none",
              backgroundColor: theme.palette.background.paper,
              transition: theme.transitions.create("width", {
                duration: theme.transitions.duration.shortest,
              }),
            },
          })}
        >
          {drawerContent(desktopNavCollapsed)}
        </Drawer>
      ) : null}

      {!desktop ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
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
              boxShadow: `inset -1px 0 0 ${alpha(theme.palette.primary.main, 0.16)}`,
              backgroundImage: "none",
              backgroundColor: theme.palette.background.paper,
            },
          })}
        >
          {drawerContent(false)}
        </Drawer>
      ) : null}

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: "100%" }}>
        <Toolbar sx={{ minHeight: `${topBarHeight.xs}px`, "@media (min-width:600px)": { minHeight: `${topBarHeight.sm}px` } }} />
        {children}
      </Box>
    </Box>
  );
}
