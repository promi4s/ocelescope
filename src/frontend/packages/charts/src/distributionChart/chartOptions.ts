import type { EChartsOption } from "echarts";

import { gaussianKDE } from "./kde";
import { fmtNum, safeMax, safeMin } from "./stats";
import type { HistBin } from "./types";

function createKdeData(
  values: number[],
  bandwidth: number,
): Array<[number, number]> {
  const min = safeMin(values);
  const max = safeMax(values);

  const points = Array.from(
    { length: 256 },
    (_, index) => min + ((max - min) * index) / 255,
  );

  const densities = gaussianKDE(values, bandwidth, points);

  return points.map((x, index) => [x, densities[index] ?? 0]);
}

export function histogramOption(bins: HistBin[]): EChartsOption {
  const rotate = bins.length > 10 ? 35 : 0;
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);

  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: rotate ? 64 : 36,
      top: 12,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const [{ dataIndex = 0 } = {}] = params as Array<{
          dataIndex: number;
        }>;

        const bin = bins[dataIndex];
        if (!bin) return "";

        const percent =
          total > 0 ? ((bin.count / total) * 100).toFixed(1) : "0.0";

        return [
          `<strong>[${fmtNum(bin.lower)}, ${fmtNum(bin.upper)})</strong>`,
          `Count: <b>${bin.count.toLocaleString("en-US")}</b>`,
          `Share: <b>${percent}%</b>`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: bins.map((bin) => bin.label),
      axisLabel: {
        rotate,
        overflow: "truncate",
        width: 100,
      },
      axisTick: {
        alignWithLabel: true,
      },
    },
    yAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 44,
    },
    series: [
      {
        name: "Histogram",
        type: "bar",
        data: bins.map((bin) => bin.count),
        barCategoryGap: "0%",
      },
    ],
  };
}

export function kdeOption(values: number[], bandwidth: number): EChartsOption {
  const min = safeMin(values);
  const max = safeMax(values);

  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: 36,
      top: 12,
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const [{ data } = {}] = params as Array<{
          data: [number, number];
        }>;

        if (!data) return "";

        return [
          `x: <b>${fmtNum(data[0])}</b>`,
          `Density: <b>${data[1].toExponential(3)}</b>`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "value",
      min,
      max,
    },
    yAxis: {
      type: "value",
      name: "Density",
      nameLocation: "middle",
      nameGap: 56,
    },
    series: [
      {
        name: "KDE",
        type: "line",
        data: createKdeData(values, bandwidth),
        symbol: "none",
        smooth: false,
        areaStyle: {
          opacity: 0.2,
        },
      },
    ],
  };
}

export function bothOption(
  bins: HistBin[],
  values: number[],
  bandwidth: number,
): EChartsOption {
  const min = safeMin(values);
  const max = safeMax(values);
  const rotate = bins.length > 10 ? 35 : 0;
  const total = values.length;

  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: rotate ? 64 : 36,
      top: 28,
    },
    legend: {
      show: true,
      top: 0,
      data: ["Histogram", "KDE"],
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const entries = params as Array<{
          dataIndex: number;
          seriesName: string;
        }>;

        const histogramEntry = entries.find(
          (entry) => entry.seriesName === "Histogram",
        );

        if (!histogramEntry) return "";

        const bin = bins[histogramEntry.dataIndex];
        if (!bin) return "";

        const percent =
          total > 0 ? ((bin.count / total) * 100).toFixed(1) : "0.0";

        return [
          `<strong>[${fmtNum(bin.lower)}, ${fmtNum(bin.upper)})</strong>`,
          `Count: <b>${bin.count.toLocaleString("en-US")}</b> (${percent}%)`,
          `Density: <b>${bin.density.toExponential(3)}</b>`,
        ].join("<br/>");
      },
    },
    xAxis: [
      {
        type: "category",
        data: bins.map((bin) => bin.label),
        axisLabel: {
          rotate,
          overflow: "truncate",
          width: 100,
        },
        axisTick: {
          alignWithLabel: true,
        },
      },
      {
        type: "value",
        min,
        max,
        show: false,
      },
    ],
    yAxis: {
      type: "value",
      name: "Density",
      nameLocation: "middle",
      nameGap: 56,
    },
    series: [
      {
        name: "Histogram",
        type: "bar",
        xAxisIndex: 0,
        data: bins.map((bin) => bin.density),
        barCategoryGap: "0%",
        itemStyle: {
          opacity: 0.55,
        },
      },
      {
        name: "KDE",
        type: "line",
        xAxisIndex: 1,
        data: createKdeData(values, bandwidth),
        symbol: "none",
        smooth: false,
      },
    ],
  };
}
