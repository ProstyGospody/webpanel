import { Alert, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";

import { EmptyState, LoadingState } from "@/components/ui/state-message";
import { OverviewTrendPoint } from "@/domain/overview/types";
import { formatDateTime, formatRate } from "@/utils/format";

type OverviewChartsProps = {
  loading: boolean;
  trendPoints: OverviewTrendPoint[];
  connectionsTCP: number;
  connectionsUDP: number;
  connectionsBreakdownAvailable: boolean;
};

export function OverviewCharts({
  loading,
  trendPoints,
  connectionsTCP,
  connectionsUDP,
  connectionsBreakdownAvailable,
}: OverviewChartsProps) {
  const chartPoints = trendPoints.slice(-48);
  const hasTrend = chartPoints.length > 1;
  const xAxis = chartPoints.map((point) => new Date(point.timestamp));
  const lastTimestamp = chartPoints.length ? chartPoints[chartPoints.length - 1].timestamp : "";

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, xl: 7 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={0.25}>
                <Typography variant="h6">Traffic Trend</Typography>
                <Typography variant="body2" color="text.secondary">
                  Hysteria 2 upload and download throughput from stored snapshots.
                </Typography>
              </Stack>
              {loading ? (
                <LoadingState message="Loading traffic history..." minHeight={280} />
              ) : !hasTrend ? (
                <EmptyState title="No traffic history yet" description="Snapshots will appear after scheduler polling cycles." minHeight={280} />
              ) : (
                <LineChart
                  height={300}
                  margin={{ top: 24, right: 16, bottom: 34, left: 60 }}
                  xAxis={[
                    {
                      data: xAxis,
                      scaleType: "time",
                      valueFormatter: (value) => formatDateTime(value instanceof Date ? value.toISOString() : String(value)),
                    },
                  ]}
                  yAxis={[
                    {
                      valueFormatter: (value) => formatRate(value || 0),
                    },
                  ]}
                  series={[
                    {
                      id: "upload",
                      label: "Upload",
                      curve: "monotoneX",
                      data: chartPoints.map((point) => point.upload_bps),
                      valueFormatter: (value) => formatRate(value || 0),
                    },
                    {
                      id: "download",
                      label: "Download",
                      curve: "monotoneX",
                      data: chartPoints.map((point) => point.download_bps),
                      valueFormatter: (value) => formatRate(value || 0),
                    },
                  ]}
                  grid={{ horizontal: true }}
                />
              )}
              {lastTimestamp ? (
                <Typography variant="caption" color="text.secondary">
                  Last chart sample: {formatDateTime(lastTimestamp)}
                </Typography>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={0.25}>
                <Typography variant="h6">Connections Trend</Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Hysteria 2 client connections over time.
                </Typography>
              </Stack>
              {loading ? (
                <LoadingState message="Loading connection trend..." minHeight={260} />
              ) : !hasTrend ? (
                <EmptyState title="No connection trend data" description="History is required to render this chart." minHeight={260} />
              ) : (
                <LineChart
                  height={250}
                  margin={{ top: 16, right: 16, bottom: 30, left: 42 }}
                  xAxis={[
                    {
                      data: xAxis,
                      scaleType: "time",
                      valueFormatter: (value) => formatDateTime(value instanceof Date ? value.toISOString() : String(value)),
                    },
                  ]}
                  series={[
                    {
                      id: "online",
                      label: "Total Connections",
                      curve: "linear",
                      data: chartPoints.map((point) => point.online_count),
                      valueFormatter: (value) => `${Math.max(0, Math.round(value || 0))}`,
                    },
                  ]}
                  yAxis={[
                    {
                      min: 0,
                      valueFormatter: (value) => `${Math.max(0, Math.round(value || 0))}`,
                    },
                  ]}
                  grid={{ horizontal: true }}
                />
              )}

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Connections TCP / UDP</Typography>
                {connectionsBreakdownAvailable ? (
                  <PieChart
                    height={210}
                    margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    series={[
                      {
                        innerRadius: 42,
                        outerRadius: 82,
                        paddingAngle: 2,
                        cornerRadius: 3,
                        data: [
                          { id: "tcp", value: Math.max(0, connectionsTCP), label: "Connections TCP" },
                          { id: "udp", value: Math.max(0, connectionsUDP), label: "Connections UDP" },
                        ],
                      },
                    ]}
                  />
                ) : (
                  <Alert severity="info">
                    Hysteria live API does not expose protocol-specific connection breakdown for this instance yet.
                  </Alert>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
