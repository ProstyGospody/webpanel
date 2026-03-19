import { createTheme } from "@mui/material";

export const panelTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#29c6ff", light: "#87e4ff", dark: "#0591c0" },
    secondary: { main: "#ffb84d", light: "#ffd18f", dark: "#b87821" },
    background: { default: "#08101f", paper: "#111c31" },
    success: { main: "#34d399" },
    warning: { main: "#fbbf24" },
    error: { main: "#f87171" },
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
  shape: { borderRadius: 14 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid rgba(108, 159, 235, 0.26)",
          background: "linear-gradient(165deg, rgba(17,30,51,0.95) 0%, rgba(11,22,38,0.95) 100%)",
          boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { borderRadius: 14 } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 12, paddingInline: 16 } } },
    MuiTextField: { defaultProps: { size: "small" } },
  },
});
