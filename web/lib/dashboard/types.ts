export type DashboardSeriesPoint = {
  timestamp: string;
  value: number | null;
};

export type DashboardNetworkPoint = {
  timestamp: string;
  rxBps: number | null;
  txBps: number | null;
};

export type DashboardSummary = {
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  memoryUsagePercent: number | null;
  networkRxBps: number | null;
  networkTxBps: number | null;
};

export type DashboardInterfaceRow = {
  device: string;
  rxBps: number | null;
  txBps: number | null;
  rxErrorsPerSec: number | null;
  txErrorsPerSec: number | null;
  rxDropsPerSec: number | null;
  txDropsPerSec: number | null;
  health: "healthy" | "degraded" | "critical" | "unknown";
};

export type DashboardExtras = {
  load1: number | null;
  load5: number | null;
  load15: number | null;
  diskReadBps: number | null;
  diskWriteBps: number | null;
};

export type DashboardMetricsDto = {
  generatedAt: string;
  source: "prometheus";
  partial: boolean;
  errors: string[];
  refreshIntervalMs: number;
  summary: DashboardSummary;
  cpu: {
    window15m: DashboardSeriesPoint[];
    window1h: DashboardSeriesPoint[];
  };
  memory: {
    window1h: DashboardSeriesPoint[];
  };
  network: {
    window1h: DashboardNetworkPoint[];
  };
  interfaces: DashboardInterfaceRow[];
  extras: DashboardExtras;
};
