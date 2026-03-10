import type {
  DashboardInterfaceRow,
  DashboardMetricsDto,
  DashboardNetworkPoint,
  DashboardSeriesPoint,
} from "@/lib/dashboard/types";
import { createPrometheusClient, type PrometheusRangeSeries, type PrometheusSample } from "@/lib/metrics/prometheus";

const NETWORK_DEVICE_FILTER = 'device!~"^(lo|docker.*|veth.*|br.*|virbr.*|zt.*)$"';

const QUERIES = {
  cpuCurrent: '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])))',
  cpuRange: '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])))',
  memoryAvailableCurrent: "sum(node_memory_MemAvailable_bytes)",
  memoryTotalCurrent: "sum(node_memory_MemTotal_bytes)",
  memoryUsageRange: "100 * (1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)))",
  networkRxCurrent: `sum(rate(node_network_receive_bytes_total{${NETWORK_DEVICE_FILTER}}[1m]))`,
  networkTxCurrent: `sum(rate(node_network_transmit_bytes_total{${NETWORK_DEVICE_FILTER}}[1m]))`,
  networkRxRange: `sum(rate(node_network_receive_bytes_total{${NETWORK_DEVICE_FILTER}}[1m]))`,
  networkTxRange: `sum(rate(node_network_transmit_bytes_total{${NETWORK_DEVICE_FILTER}}[1m]))`,
  interfaceRx: `sum by (device) (rate(node_network_receive_bytes_total{${NETWORK_DEVICE_FILTER}}[1m]))`,
  interfaceTx: `sum by (device) (rate(node_network_transmit_bytes_total{${NETWORK_DEVICE_FILTER}}[1m]))`,
  interfaceRxErrors: `sum by (device) (rate(node_network_receive_errs_total{${NETWORK_DEVICE_FILTER}}[5m]))`,
  interfaceTxErrors: `sum by (device) (rate(node_network_transmit_errs_total{${NETWORK_DEVICE_FILTER}}[5m]))`,
  interfaceRxDrops: `sum by (device) (rate(node_network_receive_drop_total{${NETWORK_DEVICE_FILTER}}[5m]))`,
  interfaceTxDrops: `sum by (device) (rate(node_network_transmit_drop_total{${NETWORK_DEVICE_FILTER}}[5m]))`,
  load1: "avg(node_load1)",
  load5: "avg(node_load5)",
  load15: "avg(node_load15)",
  diskRead: 'sum(rate(node_disk_read_bytes_total{device!~"^(loop.*|ram.*|fd.*|sr.*|dm-.*)$"}[5m]))',
  diskWrite: 'sum(rate(node_disk_written_bytes_total{device!~"^(loop.*|ram.*|fd.*|sr.*|dm-.*)$"}[5m]))',
};

export async function loadDashboardMetrics(): Promise<DashboardMetricsDto> {
  const prometheus = createPrometheusClient();
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const errors: string[] = [];

  const refreshIntervalMs = getPositiveInt(process.env.DASHBOARD_REFRESH_INTERVAL_MS, 10_000);

  const safeInstant = async (name: string, query: string): Promise<number | null> => {
    try {
      const vector = await prometheus.queryInstant(query);
      return pickSingleValue(vector);
    } catch (error) {
      errors.push(formatQueryError(name, error));
      return null;
    }
  };

  const safeVector = async (name: string, query: string): Promise<PrometheusSample[]> => {
    try {
      return await prometheus.queryInstant(query);
    } catch (error) {
      errors.push(formatQueryError(name, error));
      return [];
    }
  };

  const safeRange = async (
    name: string,
    query: string,
    startUnix: number,
    endUnix: number,
    stepSec: number
  ): Promise<PrometheusRangeSeries[]> => {
    try {
      return await prometheus.queryRange(query, startUnix, endUnix, stepSec);
    } catch (error) {
      errors.push(formatQueryError(name, error));
      return [];
    }
  };

  const [
    cpuCurrent,
    memoryAvailableCurrent,
    memoryTotalCurrent,
    networkRxCurrent,
    networkTxCurrent,
    cpu15mRaw,
    cpu1hRaw,
    memory1hRaw,
    networkRx1hRaw,
    networkTx1hRaw,
    interfaceRxRaw,
    interfaceTxRaw,
    interfaceRxErrorsRaw,
    interfaceTxErrorsRaw,
    interfaceRxDropsRaw,
    interfaceTxDropsRaw,
    load1,
    load5,
    load15,
    diskReadBps,
    diskWriteBps,
  ] = await Promise.all([
    safeInstant("cpu-current", QUERIES.cpuCurrent),
    safeInstant("memory-available-current", QUERIES.memoryAvailableCurrent),
    safeInstant("memory-total-current", QUERIES.memoryTotalCurrent),
    safeInstant("network-rx-current", QUERIES.networkRxCurrent),
    safeInstant("network-tx-current", QUERIES.networkTxCurrent),
    safeRange("cpu-15m", QUERIES.cpuRange, nowSec - 15 * 60, nowSec, 15),
    safeRange("cpu-1h", QUERIES.cpuRange, nowSec - 60 * 60, nowSec, 60),
    safeRange("memory-1h", QUERIES.memoryUsageRange, nowSec - 60 * 60, nowSec, 60),
    safeRange("network-rx-1h", QUERIES.networkRxRange, nowSec - 60 * 60, nowSec, 60),
    safeRange("network-tx-1h", QUERIES.networkTxRange, nowSec - 60 * 60, nowSec, 60),
    safeVector("interfaces-rx", QUERIES.interfaceRx),
    safeVector("interfaces-tx", QUERIES.interfaceTx),
    safeVector("interfaces-rx-errors", QUERIES.interfaceRxErrors),
    safeVector("interfaces-tx-errors", QUERIES.interfaceTxErrors),
    safeVector("interfaces-rx-drops", QUERIES.interfaceRxDrops),
    safeVector("interfaces-tx-drops", QUERIES.interfaceTxDrops),
    safeInstant("load-1", QUERIES.load1),
    safeInstant("load-5", QUERIES.load5),
    safeInstant("load-15", QUERIES.load15),
    safeInstant("disk-read", QUERIES.diskRead),
    safeInstant("disk-write", QUERIES.diskWrite),
  ]);

  const memoryUsedBytes =
    memoryTotalCurrent !== null && memoryAvailableCurrent !== null
      ? Math.max(0, memoryTotalCurrent - memoryAvailableCurrent)
      : null;
  const memoryUsagePercent =
    memoryTotalCurrent !== null && memoryTotalCurrent > 0 && memoryUsedBytes !== null
      ? clampPercent((memoryUsedBytes / memoryTotalCurrent) * 100)
      : null;

  const cpuWindow15m = seriesFromFirst(cpu15mRaw, (value) => clampPercent(value));
  const cpuWindow1h = seriesFromFirst(cpu1hRaw, (value) => clampPercent(value));
  const memoryWindow1h = seriesFromFirst(memory1hRaw, (value) => clampPercent(value));
  const networkWindow1h = mergeNetworkSeries(networkRx1hRaw, networkTx1hRaw);

  const interfaces = buildInterfacesTable({
    rx: vectorByDevice(interfaceRxRaw),
    tx: vectorByDevice(interfaceTxRaw),
    rxErrors: vectorByDevice(interfaceRxErrorsRaw),
    txErrors: vectorByDevice(interfaceTxErrorsRaw),
    rxDrops: vectorByDevice(interfaceRxDropsRaw),
    txDrops: vectorByDevice(interfaceTxDropsRaw),
  });

  return {
    generatedAt: new Date(nowMs).toISOString(),
    source: "prometheus",
    partial: errors.length > 0,
    errors,
    refreshIntervalMs,
    summary: {
      cpuPercent: cpuCurrent !== null ? clampPercent(cpuCurrent) : null,
      memoryUsedBytes,
      memoryTotalBytes: memoryTotalCurrent,
      memoryUsagePercent,
      networkRxBps: normalizeRate(networkRxCurrent),
      networkTxBps: normalizeRate(networkTxCurrent),
    },
    cpu: {
      window15m: cpuWindow15m,
      window1h: cpuWindow1h,
    },
    memory: {
      window1h: memoryWindow1h,
    },
    network: {
      window1h: networkWindow1h,
    },
    interfaces,
    extras: {
      load1: normalizeNonNegative(load1),
      load5: normalizeNonNegative(load5),
      load15: normalizeNonNegative(load15),
      diskReadBps: normalizeRate(diskReadBps),
      diskWriteBps: normalizeRate(diskWriteBps),
    },
  };
}

function formatQueryError(name: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown query error";
  return `${name}: ${message}`;
}

function pickSingleValue(vector: PrometheusSample[]): number | null {
  if (vector.length === 0) {
    return null;
  }

  // Most queries are pre-aggregated with `sum`/`avg`; still guard against multiple samples.
  const total = vector.reduce((acc, item) => acc + item.value, 0);
  return Number.isFinite(total) ? total : null;
}

function seriesFromFirst(
  series: PrometheusRangeSeries[],
  mapValue: (value: number) => number
): DashboardSeriesPoint[] {
  if (series.length === 0 || series[0].values.length === 0) {
    return [];
  }

  return series[0].values.map((point) => ({
    timestamp: new Date(point.timestamp * 1000).toISOString(),
    value: mapValue(point.value),
  }));
}

function mergeNetworkSeries(rxSeries: PrometheusRangeSeries[], txSeries: PrometheusRangeSeries[]): DashboardNetworkPoint[] {
  const buckets = new Map<string, DashboardNetworkPoint>();

  for (const point of rxSeries[0]?.values || []) {
    const timestamp = new Date(point.timestamp * 1000).toISOString();
    buckets.set(timestamp, {
      timestamp,
      rxBps: normalizeRate(point.value),
      txBps: null,
    });
  }

  for (const point of txSeries[0]?.values || []) {
    const timestamp = new Date(point.timestamp * 1000).toISOString();
    const current = buckets.get(timestamp);
    if (current) {
      current.txBps = normalizeRate(point.value);
    } else {
      buckets.set(timestamp, {
        timestamp,
        rxBps: null,
        txBps: normalizeRate(point.value),
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function vectorByDevice(vector: PrometheusSample[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const sample of vector) {
    const device = sample.metric.device;
    if (!device) {
      continue;
    }

    map.set(device, (map.get(device) || 0) + sample.value);
  }

  return map;
}

function buildInterfacesTable(input: {
  rx: Map<string, number>;
  tx: Map<string, number>;
  rxErrors: Map<string, number>;
  txErrors: Map<string, number>;
  rxDrops: Map<string, number>;
  txDrops: Map<string, number>;
}): DashboardInterfaceRow[] {
  const devices = new Set<string>([
    ...input.rx.keys(),
    ...input.tx.keys(),
    ...input.rxErrors.keys(),
    ...input.txErrors.keys(),
    ...input.rxDrops.keys(),
    ...input.txDrops.keys(),
  ]);

  const rows: DashboardInterfaceRow[] = Array.from(devices).map((device) => {
    const rxBps = normalizeRate(input.rx.get(device) ?? null);
    const txBps = normalizeRate(input.tx.get(device) ?? null);
    const rxErrorsPerSec = normalizeNonNegative(input.rxErrors.get(device) ?? null);
    const txErrorsPerSec = normalizeNonNegative(input.txErrors.get(device) ?? null);
    const rxDropsPerSec = normalizeNonNegative(input.rxDrops.get(device) ?? null);
    const txDropsPerSec = normalizeNonNegative(input.txDrops.get(device) ?? null);

    return {
      device,
      rxBps,
      txBps,
      rxErrorsPerSec,
      txErrorsPerSec,
      rxDropsPerSec,
      txDropsPerSec,
      health: classifyInterfaceHealth({
        rxBps,
        txBps,
        rxErrorsPerSec,
        txErrorsPerSec,
        rxDropsPerSec,
        txDropsPerSec,
      }),
    };
  });

  return rows.sort((a, b) => {
    const aTotal = (a.rxBps || 0) + (a.txBps || 0);
    const bTotal = (b.rxBps || 0) + (b.txBps || 0);
    if (aTotal === bTotal) {
      return a.device.localeCompare(b.device);
    }
    return bTotal - aTotal;
  });
}

function classifyInterfaceHealth(input: {
  rxBps: number | null;
  txBps: number | null;
  rxErrorsPerSec: number | null;
  txErrorsPerSec: number | null;
  rxDropsPerSec: number | null;
  txDropsPerSec: number | null;
}): DashboardInterfaceRow["health"] {
  const traffic = (input.rxBps || 0) + (input.txBps || 0);
  const issues =
    (input.rxErrorsPerSec || 0) +
    (input.txErrorsPerSec || 0) +
    (input.rxDropsPerSec || 0) +
    (input.txDropsPerSec || 0);

  if (traffic <= 0 && issues <= 0) {
    return "unknown";
  }
  if (issues >= 1) {
    return "critical";
  }
  if (issues >= 0.01) {
    return "degraded";
  }
  return "healthy";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function normalizeRate(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, value);
}

function normalizeNonNegative(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, value);
}

function getPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}
