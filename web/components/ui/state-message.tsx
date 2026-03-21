import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

export function LoadingState({ message, minHeight = 260 }: { message: string; minHeight?: number }) {
  return (
    <Paper variant="outlined" sx={{ minHeight, display: "grid", placeItems: "center" }}>
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={26} />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Stack>
    </Paper>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  minHeight = 220,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  minHeight?: number;
}) {
  return (
    <Paper variant="outlined" sx={{ minHeight, display: "grid", placeItems: "center", px: 2 }}>
      <Stack spacing={1} alignItems="center" textAlign="center">
        {icon || <InboxRoundedIcon sx={{ color: "text.secondary" }} />}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
