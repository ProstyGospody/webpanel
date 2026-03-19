"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { ReactNode, useMemo } from "react";

const baseTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#2bd4ff",
      light: "#80e4ff",
      dark: "#0aa4cc",
    },
    secondary: {
      main: "#ffb347",
      light: "#ffd497",
      dark: "#c97a17",
    },
    background: {
      default: "#081022",
      paper: "#111b30",
    },
    success: {
      main: "#34d399",
    },
    warning: {
      main: "#fbbf24",
    },
    error: {
      main: "#f87171",
    },
  },
  typography: {
    fontFamily: "var(--font-panel), \"Segoe UI\", sans-serif",
    h1: { fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontSize: "1.3rem", fontWeight: 700 },
    h4: { fontSize: "1.15rem", fontWeight: 700 },
    h5: { fontSize: "1rem", fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid rgba(110, 159, 241, 0.25)",
          background: "linear-gradient(165deg, rgba(18,30,53,0.95) 0%, rgba(13,23,42,0.95) 100%)",
          boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 16,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
  },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const theme = useMemo(() => baseTheme, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
