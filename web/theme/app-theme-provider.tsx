"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { panelLightTheme, panelTheme } from "@/theme/panel-theme";

type ThemeMode = "dark" | "light";
type ThemeModeContextState = {
  mode: ThemeMode;
  toggleMode: () => void;
};

const STORAGE_KEY = "panel-theme-mode";
const ThemeModeContext = createContext<ThemeModeContextState>({
  mode: "dark",
  toggleMode: () => {},
});

export function useAppThemeMode(): ThemeModeContextState {
  return useContext(ThemeModeContext);
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "light" || stored === "dark") {
      setMode(stored);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => (mode === "light" ? panelLightTheme : panelTheme), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
