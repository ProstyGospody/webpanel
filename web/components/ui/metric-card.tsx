import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ReactNode } from "react";

type MetricTrend = "up" | "down" | "flat";

function trendIcon(trend?: MetricTrend): ReactNode {
  if (trend === "up") {
    return <TrendingUpRoundedIcon fontSize="small" />;
  }
  if (trend === "down") {
    return <TrendingDownRoundedIcon fontSize="small" />;
  }
  return <TrendingFlatRoundedIcon fontSize="small" />;
}

export function MetricCard({
  label,
  value,
  caption,
  tone = "primary",
  trend,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "primary" | "secondary" | "success" | "warning" | "error";
  trend?: MetricTrend;
}) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        p: 2,
        height: "100%",
        borderColor: alpha(theme.palette[tone].main, 0.34),
        backgroundColor: alpha(theme.palette.background.paper, 0.72),
      })}
    >
      <Stack spacing={1.2} sx={{ height: "100%" }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: "auto" }}>
          <Typography variant="caption" color="text.secondary">
            {caption || " "}
          </Typography>
          {trend ? (
            <Chip
              size="small"
              variant="outlined"
              color={trend === "up" ? "success" : trend === "down" ? "warning" : "default"}
              icon={trendIcon(trend)}
              label={trend === "up" ? "Rising" : trend === "down" ? "Dropping" : "Stable"}
            />
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
