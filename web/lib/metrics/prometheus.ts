export type PrometheusSample = {
  metric: Record<string, string>;
  timestamp: number;
  value: number;
};

export type PrometheusRangePoint = {
  timestamp: number;
  value: number;
};

export type PrometheusRangeSeries = {
  metric: Record<string, string>;
  values: PrometheusRangePoint[];
};

type PrometheusSuccessResponse = {
  status: "success";
  data: {
    resultType: "vector" | "matrix" | "scalar" | "string";
    result: Array<{
      metric?: Record<string, string>;
      value?: [number | string, string | number];
      values?: Array<[number | string, string | number]>;
    }>;
  };
};

type PrometheusErrorResponse = {
  status: "error";
  errorType?: string;
  error?: string;
};

type PrometheusApiResponse = PrometheusSuccessResponse | PrometheusErrorResponse;

export class PrometheusQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrometheusQueryError";
  }
}

export class PrometheusClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(baseUrl: string, timeoutMs: number) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  async queryInstant(query: string): Promise<PrometheusSample[]> {
    const payload = await this.request("/api/v1/query", { query });

    if (payload.data.resultType !== "vector") {
      throw new PrometheusQueryError(`unexpected result type: ${payload.data.resultType}`);
    }

    return payload.data.result
      .map((series) => {
        const parsed = parsePrometheusValue(series.value);
        if (!parsed) {
          return null;
        }

        return {
          metric: series.metric || {},
          timestamp: parsed.timestamp,
          value: parsed.value,
        } satisfies PrometheusSample;
      })
      .filter((entry): entry is PrometheusSample => entry !== null);
  }

  async queryRange(query: string, startUnix: number, endUnix: number, stepSec: number): Promise<PrometheusRangeSeries[]> {
    const payload = await this.request("/api/v1/query_range", {
      query,
      start: String(startUnix),
      end: String(endUnix),
      step: String(stepSec),
    });

    if (payload.data.resultType !== "matrix") {
      throw new PrometheusQueryError(`unexpected result type: ${payload.data.resultType}`);
    }

    return payload.data.result
      .map((series) => {
        const points = (series.values || [])
          .map((rawPoint) => parsePrometheusValue(rawPoint))
          .filter((point): point is PrometheusRangePoint => point !== null);

        return {
          metric: series.metric || {},
          values: points,
        } satisfies PrometheusRangeSeries;
      })
      .filter((series) => series.values.length > 0);
  }

  private async request(pathname: string, params: Record<string, string>): Promise<PrometheusSuccessResponse> {
    if (!this.baseUrl) {
      throw new PrometheusQueryError("PROMETHEUS_URL is empty");
    }

    const search = new URLSearchParams(params);
    const url = `${this.baseUrl}${pathname}?${search.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PrometheusQueryError(`prometheus request failed with ${response.status}`);
      }

      const payload = (await response.json()) as PrometheusApiResponse;
      if (payload.status !== "success") {
        const details = payload.error ? `${payload.errorType || "error"}: ${payload.error}` : "unknown error";
        throw new PrometheusQueryError(`prometheus request returned error (${details})`);
      }

      return payload;
    } catch (error) {
      if (error instanceof PrometheusQueryError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new PrometheusQueryError(`prometheus request timed out after ${this.timeoutMs}ms`);
      }

      throw new PrometheusQueryError(error instanceof Error ? error.message : "unknown prometheus error");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createPrometheusClient(): PrometheusClient {
  const baseUrl = process.env.PROMETHEUS_URL || "http://127.0.0.1:9090";
  const timeoutMs = parseTimeoutMs(process.env.PROMETHEUS_QUERY_TIMEOUT_MS || process.env.PROMETHEUS_QUERY_TIMEOUT, 2500);

  return new PrometheusClient(baseUrl, timeoutMs);
}

function parsePrometheusValue(raw?: [number | string, string | number]): PrometheusRangePoint | null {
  if (!raw || raw.length !== 2) {
    return null;
  }

  const timestamp = toNumber(raw[0]);
  const value = toNumber(raw[1]);
  if (timestamp === null || value === null) {
    return null;
  }

  return {
    timestamp,
    value,
  };
}

function toNumber(value: string | number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function parseTimeoutMs(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.endsWith("ms")) {
    const ms = Number(trimmed.slice(0, -2));
    return Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : fallback;
  }

  if (trimmed.endsWith("s")) {
    const sec = Number(trimmed.slice(0, -1));
    return Number.isFinite(sec) && sec > 0 ? Math.floor(sec * 1000) : fallback;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}
