import { Chip } from "@mui/material";

export function StatusChip({ status }: { status: string }) {
  const normalized = (status || "unknown").trim().toLowerCase();
  const label = status && status.trim() ? status : "unknown";

  if (normalized.includes("active") || normalized.includes("running") || normalized.includes("enabled")) {
    return <Chip size="small" color="success" variant="outlined" label={label} />;
  }
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("disabled")) {
    return <Chip size="small" color="error" variant="outlined" label={label} />;
  }
  if (normalized.includes("inactive") || normalized.includes("stopped")) {
    return <Chip size="small" color="warning" variant="outlined" label={label} />;
  }
  return <Chip size="small" variant="outlined" label={label} />;
}
