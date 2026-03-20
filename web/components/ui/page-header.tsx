import { Paper, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.6, md: 1.8 },
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={{ xs: 1.5, lg: 2 }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
      >
        <Stack spacing={0.35}>
          <Typography variant="h4">{title}</Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
