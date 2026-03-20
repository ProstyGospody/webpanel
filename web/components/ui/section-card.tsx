import { Paper, Stack, Typography } from "@mui/material";
import { SxProps, Theme } from "@mui/material/styles";
import { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  contentSx,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentSx?: SxProps<Theme>;
}) {
  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        sx={{ px: 2.25, py: 1.8, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
      >
        <Stack spacing={0.25}>
          <Typography variant="h6">{title}</Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {actions}
      </Stack>
      <Stack sx={[{ p: 2.25 }, contentSx]}>{children}</Stack>
    </Paper>
  );
}
