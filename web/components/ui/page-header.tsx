import { Stack } from "@mui/material";
import { ReactNode } from "react";

export function PageHeader({ actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  if (!actions) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
      {actions}
    </Stack>
  );
}
