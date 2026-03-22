import { Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";

type ChipTone = "success" | "error" | "warning" | "default";

function resolveTone(status: string): ChipTone {
  const normalized = (status || "unknown").toLowerCase();

  if (normalized.includes("active") || normalized.includes("running") || normalized.includes("enabled")) {
    return "success";
  }
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("disabled")) {
    return "error";
  }
  if (normalized.includes("inactive") || normalized.includes("stopped")) {
    return "warning";
  }
  return "default";
}

export function StatusChip({ status }: { status: string }) {
  const tone = resolveTone(status);
  const color = tone === "default" ? "default" : tone;

  return (
    <Chip
      size="small"
      label={status}
      color={color}
      sx={(theme) => {
        if (tone === "default") {
          return {};
        }

        const palette = theme.palette[tone];
        return {
          backgroundColor: alpha(palette.main, theme.palette.mode === "light" ? 0.2 : 0.24),
          color: theme.palette.mode === "light" ? palette.dark : palette.light,
          border: `1px solid ${alpha(palette.main, theme.palette.mode === "light" ? 0.34 : 0.4)}`,
          fontWeight: 700,
          "& .MuiChip-label": {
            letterSpacing: "0.01em",
          },
        };
      }}
    />
  );
}
