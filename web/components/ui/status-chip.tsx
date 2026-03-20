import { Chip } from "@mui/material";

export function StatusChip({ status }: { status: string }) {
  const normalized = (status || "unknown").toLowerCase();

  if (normalized.includes("active") || normalized.includes("running") || normalized.includes("enabled")) {
    return <Chip size="small" color="success" label={status} />;
  }
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("disabled")) {
    return <Chip size="small" color="error" label={status} />;
  }
  if (normalized.includes("inactive") || normalized.includes("stopped")) {
    return <Chip size="small" color="warning" label={status} />;
  }
  return <Chip size="small" label={status} />;
}
