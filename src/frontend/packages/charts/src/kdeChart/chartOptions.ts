import type { EChartsOption } from "echarts";

import type { LinePoint } from "../lineChart/types";

function fmtNum(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2);
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

export function kdeChartOption(points: LinePoint[]): EChartsOption {
  return {
    grid: { containLabel: true, left: 16, right: 16, bottom: 36, top: 12 },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const [item] = params as Array<{ value: [number, number]; marker: string }>;
        if (!item) return "";
        return `${item.marker}${fmtNum(item.value[0])}: <b>${fmtNum(item.value[1])}</b>`;
      },
    },
    xAxis: {
      type: "value",
      axisLabel: { formatter: fmtNum },
    },
    yAxis: {
      type: "value",
      name: "Density",
      nameLocation: "middle",
      nameGap: 50,
      axisLabel: { formatter: fmtNum },
    },
    series: [
      {
        type: "line",
        data: points.map((p) => [p.x, p.y]),
        smooth: true,
        areaStyle: {},
        symbol: "none",
      },
    ],
  };
}
