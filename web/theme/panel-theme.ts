import { alpha, createTheme, type Shadows, type Theme } from "@mui/material/styles";
import type { CSSProperties } from "react";

const noShadows = Array(25).fill("none") as Shadows;
const codeFontFamily = "var(--font-panel-mono), \"JetBrains Mono\", \"IBM Plex Mono\", \"SFMono-Regular\", Menlo, Consolas, monospace";

declare module "@mui/material/styles" {
  interface TypographyVariants {
    code: CSSProperties;
  }

  interface TypographyVariantsOptions {
    code?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    code: true;
  }
}

export const panelTheme = createTheme({
  spacing: 8,
  shape: { borderRadius: 12 },
  shadows: noShadows,
  palette: {
    mode: "dark",
    primary: { main: "#3fc4ff", light: "#7fd9ff", dark: "#1f8fc0", contrastText: "#04131e" },
    secondary: { main: "#f4b859", light: "#ffd39a", dark: "#bb8531", contrastText: "#1f1303" },
    success: { main: "#46d39f", light: "#7de8bf", dark: "#28946e" },
    warning: { main: "#ffbf54", light: "#ffd995", dark: "#c38b2e" },
    error: { main: "#ff7a7a", light: "#ffacac", dark: "#c34f4f" },
    background: { default: "#060d17", paper: "#0d1726" },
    divider: "rgba(149, 178, 216, 0.2)",
    text: { primary: "#edf4ff", secondary: "#9cb1cc" },
  },
  typography: {
    fontFamily: "var(--font-panel-sans), \"Manrope\", \"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    h1: { fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.015em" },
    h4: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontSize: "1.1rem", fontWeight: 700 },
    h6: { fontSize: "1rem", fontWeight: 700 },
    subtitle1: { fontSize: "0.95rem", fontWeight: 600, letterSpacing: "0.01em" },
    subtitle2: { fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.02em" },
    body1: { fontSize: "0.95rem", lineHeight: 1.55 },
    body2: { fontSize: "0.86rem", lineHeight: 1.45 },
    caption: { fontSize: "0.76rem", lineHeight: 1.45, letterSpacing: "0.02em" },
    overline: { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: "0.01em" },
    code: {
      fontFamily: codeFontFamily,
      fontSize: "0.78rem",
      lineHeight: 1.45,
      letterSpacing: 0,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme: Theme) => ({
        ":root": {
          colorScheme: theme.palette.mode,
        },
        html: {
          minHeight: "100%",
          backgroundColor: theme.palette.background.default,
        },
        body: {
          minHeight: "100%",
          margin: 0,
          backgroundColor: theme.palette.background.default,
          backgroundImage: "none",
          color: theme.palette.text.primary,
        },
        "*": {
          boxSizing: "border-box",
        },
        "*::-webkit-scrollbar": {
          width: 10,
          height: 10,
        },
        "*::-webkit-scrollbar-thumb": {
          borderRadius: 16,
          backgroundColor: alpha(theme.palette.primary.main, 0.4),
        },
        "*::-webkit-scrollbar-track": {
          backgroundColor: alpha(theme.palette.background.paper, 0.7),
        },
        ".MuiChartsAxis-line, .MuiChartsAxis-tick, .MuiChartsGrid-line": {
          stroke: alpha(theme.palette.divider, 0.9),
        },
        ".MuiChartsAxis-tickLabel, .MuiChartsLegend-label, .MuiChartsTooltip-labelCell, .MuiChartsTooltip-valueCell": {
          fill: theme.palette.text.secondary,
          color: theme.palette.text.secondary,
        },
      }),
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: "none",
          backgroundImage: "none",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
        variant: "outlined",
      },
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: "none",
          backgroundImage: "none",
          borderColor: theme.palette.divider,
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
        }),
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: "none",
          backgroundImage: "none",
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.92),
          backdropFilter: "blur(12px)",
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          boxShadow: "none",
          borderRight: `1px solid ${theme.palette.divider}`,
          backgroundImage: "none",
          backgroundColor: alpha(theme.palette.background.paper, 0.88),
          backdropFilter: "blur(10px)",
        }),
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: "medium",
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          boxShadow: "none",
          paddingInline: theme.spacing(1.5),
          paddingBlock: theme.spacing(0.75),
        }),
        contained: {
          boxShadow: "none",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          backgroundColor: alpha(theme.palette.background.default, 0.4),
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(theme.palette.divider, 0.95),
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(theme.palette.primary.light, 0.8),
          },
        }),
      },
    },
    MuiFormControl: {
      defaultProps: {
        fullWidth: true,
        size: "small",
      },
    },
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
        fullWidth: true,
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: alpha(theme.palette.divider, 0.85),
          paddingTop: theme.spacing(1.25),
          paddingBottom: theme.spacing(1.25),
        }),
        head: ({ theme }) => ({
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: theme.palette.text.secondary,
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          "&:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
          },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          borderColor: alpha(theme.palette.divider, 0.95),
        }),
      },
    },
    MuiSvgIcon: {
      defaultProps: {
        fontSize: "small",
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 14,
          borderColor: theme.palette.divider,
          boxShadow: "none",
          backgroundImage: "none",
          backgroundColor: alpha(theme.palette.background.paper, 0.98),
        }),
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: ({ theme }) => ({
          boxShadow: "none",
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: "none",
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          boxShadow: "none",
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: "none",
        }),
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          boxShadow: "none",
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.35),
          "&:before": {
            display: "none",
          },
        }),
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 46,
          "& .MuiAccordionSummary-content": {
            margin: `${theme.spacing(1)} 0`,
          },
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          boxShadow: "none",
        }),
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 999,
          backgroundColor: alpha(theme.palette.common.white, 0.08),
          height: 8,
        }),
      },
    },
  },
});

export const panelLightTheme = createTheme(panelTheme, {
  palette: {
    mode: "light",
    primary: { main: "#186fbf", light: "#4899e3", dark: "#0b4f8a", contrastText: "#ffffff" },
    secondary: { main: "#cf8400", light: "#f0af3e", dark: "#9a6100", contrastText: "#1f1303" },
    success: { main: "#0f8a5a", light: "#38b983", dark: "#0a6542" },
    warning: { main: "#d98a00", light: "#efad3d", dark: "#9e6500" },
    error: { main: "#b33c49", light: "#d66a76", dark: "#832733" },
    background: { default: "#eef3f9", paper: "#ffffff" },
    divider: "rgba(19, 43, 74, 0.24)",
    text: { primary: "#0d2035", secondary: "#36516f" },
    action: {
      active: "#28425f",
      hover: "rgba(24, 111, 191, 0.1)",
      selected: "rgba(24, 111, 191, 0.14)",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme: Theme) => ({
        ":root": {
          colorScheme: "light",
        },
        html: {
          minHeight: "100%",
          backgroundColor: theme.palette.background.default,
        },
        body: {
          minHeight: "100%",
          margin: 0,
          backgroundColor: theme.palette.background.default,
          backgroundImage: "none",
          color: theme.palette.text.primary,
        },
        ".MuiChartsAxis-line, .MuiChartsAxis-tick, .MuiChartsGrid-line": {
          stroke: alpha(theme.palette.divider, 0.95),
        },
        ".MuiChartsAxis-tickLabel, .MuiChartsLegend-label, .MuiChartsTooltip-labelCell, .MuiChartsTooltip-valueCell": {
          fill: alpha(theme.palette.text.primary, 0.9),
          color: alpha(theme.palette.text.primary, 0.9),
        },
      }),
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          borderColor: theme.palette.divider,
          backgroundColor: alpha(theme.palette.background.paper, 0.98),
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.98),
          backdropFilter: "blur(8px)",
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }: { theme: Theme }) => ({
          borderRight: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.98),
          backdropFilter: "none",
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          color: theme.palette.text.secondary,
        }),
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: () => ({
          color: "inherit",
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          borderColor: alpha(theme.palette.divider, 1),
        }),
      },
    },
  },
});
