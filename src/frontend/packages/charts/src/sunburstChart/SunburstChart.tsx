import type { EChartsOption } from "echarts";
import { EChartCard } from "../EChartCard";

export interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
}

export interface SunburstChartProps {
  title: string;
  data: SunburstNode[];
  total?: number;
  info?: string;
  height?: number | string;
  filename?: string;
}

export function SunburstChart({
  title,
  data,
  total,
  info,
  height = 340,
  filename = "sunburst",
}: SunburstChartProps) {
  const grandTotal = total ?? data.reduce((s, n) => s + (n.value ?? 0), 0);

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; treePathInfo: { name: string }[] };
        const path = p.treePathInfo.map((n) => n.name).join(" › ");
        const pct = grandTotal > 0 ? ((p.value / grandTotal) * 100).toFixed(1) : "–";
        return `<strong>${path}</strong><br/>Count: <b>${p.value.toLocaleString("en-US")}</b> (${pct}%)`;
      },
    },
    series: [
      {
        type: "sunburst",
        data,
        radius: ["20%", "90%"],
        emphasis: { focus: "ancestor" },
        label: { overflow: "truncate" },
        levels: [
          {},
          { r0: "20%", r: "55%", label: { align: "right" } },
          { r0: "55%", r: "90%", label: { position: "outside", padding: 3 } },
        ],
      },
    ],
  };

  return (
    <EChartCard title={title} info={info} filename={filename} height={height} option={option} />
  );
}
