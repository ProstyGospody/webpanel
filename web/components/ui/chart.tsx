"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

type ThemeName = keyof typeof THEMES;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<ThemeName, string>;
  };
};

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = React.useMemo(() => `chart-${id || uniqueId.replace(/:/g, "")}`, [id, uniqueId]);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-[16/8] justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, chart]) => chart.theme || chart.color);

  if (colorConfig.length === 0) {
    return null;
  }

  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => {
            const vars = colorConfig
              .map(([key, chart]) => {
                const color = chart.theme?.[theme as ThemeName] || chart.color;
                if (!color) {
                  return null;
                }
                return `--color-${key}: ${color};`;
              })
              .filter((entry): entry is string => Boolean(entry))
              .join(" ");

            return `${prefix} [data-chart=${id}] { ${vars} }`;
          })
          .join("\n"),
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartTooltipContentProps = {
  active?: boolean;
  payload?: Array<Record<string, any>>;
  label?: string | number;
  className?: string;
  labelFormatter?: (label: unknown, payload: Array<Record<string, any>>) => React.ReactNode;
  formatter?: (
    value: unknown,
    name: unknown,
    item: Record<string, any>,
    index: number,
    payload: Array<Record<string, any>>
  ) => React.ReactNode;
  hideLabel?: boolean;
};

function ChartTooltipContent({
  active,
  payload,
  className,
  label,
  labelFormatter,
  formatter,
  hideLabel = false,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const tooltipLabel = hideLabel
    ? null
    : labelFormatter
      ? labelFormatter(label, payload)
      : label;

  return (
    <div className={cn("min-w-40 rounded-lg border bg-background/95 p-2.5 text-xs shadow-xl backdrop-blur", className)}>
      {tooltipLabel ? <div className="mb-2 font-medium text-foreground">{tooltipLabel}</div> : null}
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          const configEntry = resolvePayloadConfig(config, item);
          const indicatorColor = item.color || item.payload?.fill || `var(--color-${item.dataKey as string})`;

          return (
            <div key={`${item.name || item.dataKey || index}`} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: indicatorColor }} />
                <span className="truncate text-muted-foreground">{configEntry?.label || item.name || item.dataKey}</span>
              </div>
              <span className="tabular-nums text-foreground">
                {formatter
                  ? formatter(item.value, item.name, item, index, payload)
                  : formatTooltipValue(item.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

type ChartLegendContentProps = {
  payload?: Array<Record<string, any>>;
  verticalAlign?: "top" | "bottom" | "middle";
  className?: string;
};

function ChartLegendContent({
  payload,
  verticalAlign = "bottom",
  className,
}: ChartLegendContentProps) {
  const { config } = useChart();

  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 text-xs",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const configEntry = resolvePayloadConfig(config, item);
        return (
          <div key={item.value} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: item.color || `var(--color-${item.dataKey as string})` }}
            />
            <span className="text-muted-foreground">{configEntry?.label || item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function resolvePayloadConfig(config: ChartConfig, item: Record<string, any>) {
  if (typeof item?.dataKey === "string" && config[item.dataKey]) {
    return config[item.dataKey];
  }

  if (typeof item?.name === "string" && config[item.name]) {
    return config[item.name];
  }

  return null;
}

function formatTooltipValue(value: unknown): string {
  if (typeof value !== "number") {
    return String(value ?? "-");
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
