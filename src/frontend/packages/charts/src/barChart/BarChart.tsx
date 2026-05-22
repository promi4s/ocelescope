import type { EChartsOption } from "echarts";
import { EChart } from "../EChart";

export interface BarSeries {
  name: string;
  data: number[];
  isOverflow?: boolean;
}

export interface BarChartProps {
  categories: string[];
  series: BarSeries[];
  stacked?: boolean;
  orientation?: "vertical" | "horizontal";
  categoryLabel?: string;
  valueLabel?: string;
  /** Full labels for tooltip when categories are abbreviated. */
  categoryMeta?: string[];
  info?: string;
  height?: number | string;
  filename?: string;
  title?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  categories,
  series,
  stacked = false,
  orientation = "vertical",
  categoryLabel,
  valueLabel,
  categoryMeta,
  info,
  height = 340,
  filename = "bar-chart",
  title,
}) => {
  const isHorizontal = orientation === "horizontal";

  const categoryAxis = {
    type: "category" as const,
    data: categories,
    name: categoryLabel,
    axisLabel: { overflow: "truncate" as const, width: 120 },
  };

  const valueAxis = {
    type: "value" as const,
    name: valueLabel,
    nameLocation: "middle" as const,
    nameGap: 44,
  };

  const option: EChartsOption = {
    grid: { containLabel: true, left: 16, right: 16, bottom: 36, top: series.length > 1 ? 28 : 12 },
    legend: series.length > 1 ? { show: true, top: 0 } : undefined,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as Array<{ dataIndex: number; seriesName: string; value: number; marker: string }>;
        const idx = arr[0]?.dataIndex ?? 0;
        const label = categoryMeta?.[idx] ?? categories[idx] ?? "";
        const rows = arr
          .filter((p) => p.value > 0)
          .map((p) => `${p.marker}${p.seriesName}: <b>${p.value.toLocaleString("en-US")}</b>`)
          .join("<br/>");
        return `<strong>${label}</strong><br/>${rows}`;
      },
    },
    xAxis: isHorizontal ? valueAxis : categoryAxis,
    yAxis: isHorizontal ? categoryAxis : valueAxis,
    series: series.map((s) => ({
      name: s.name,
      type: "bar",
      stack: stacked ? "total" : undefined,
      data: s.data,
      itemStyle: s.isOverflow ? { opacity: 0.65 } : undefined,
    })),
  };

  return (
    <EChart
      option={option}
      info={info}
      height={height}
      filename={filename}
      title={title}
    />
  );
};
