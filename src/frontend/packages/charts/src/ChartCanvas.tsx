import type { EChartsOption } from "echarts";
import type ReactEChartsType from "echarts-for-react";
import ReactECharts from "echarts-for-react";
import type { RefObject } from "react";

import type { ChartEventMap } from "./types";

interface ChartCanvasProps {
  chartRef: RefObject<ReactEChartsType | null>;
  option: EChartsOption;
  events?: ChartEventMap;
  height?: number | string;
}

export function ChartCanvas({
  chartRef,
  option,
  events,
  height = "100%",
}: ChartCanvasProps) {
  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      notMerge={false}
      lazyUpdate
      opts={{ renderer: "svg" }}
      style={{ width: "100%", height }}
      onEvents={events}
    />
  );
}
