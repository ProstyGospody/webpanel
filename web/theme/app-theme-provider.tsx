"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode } from "react";

import { panelTheme } from "@/theme/panel-theme";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={panelTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
