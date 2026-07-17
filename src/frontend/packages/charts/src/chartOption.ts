import type { EChartsOption } from "echarts";

import type { BrushConfig, ChartViewport, ZoomConfig } from "./types";

interface DataZoomOption {
  id: string;
  type: "inside" | "slider";
  xAxisIndex?: 0;
  yAxisIndex?: 0;
  start: number;
  end: number;
  height?: number;
  bottom?: number;
  brushSelect?: boolean;
  showDetail?: boolean;
  throttle?: number;
  orient?: "horizontal" | "vertical";
  width?: number;
  right?: number;
}

function zoomOptions(
  zoom: ZoomConfig,
  viewport: ChartViewport | null,
): DataZoomOption[] {
  const configuredAxis = zoom.axis ?? "x";
  const axes =
    configuredAxis === "xy" ? (["x", "y"] as const) : [configuredAxis];
  const result: DataZoomOption[] = [];

  for (const axis of axes) {
    const axisIndex =
      axis === "x" ? { xAxisIndex: 0 as const } : { yAxisIndex: 0 as const };
    const range = viewport?.[axis] ?? { min: 0, max: 100 };

    if (zoom.mouse ?? true) {
      result.push({
        id: `ocelescope-zoom-inside-${axis}`,
        type: "inside",
        ...axisIndex,
        start: range.min,
        end: range.max,
        throttle: 50,
      });
    }

    if (zoom.slider ?? true) {
      result.push({
        id: `ocelescope-zoom-slider-${axis}`,
        type: "slider",
        ...axisIndex,
        start: range.min,
        end: range.max,
        ...(axis === "y"
          ? { orient: "vertical", width: 18, right: 8 }
          : { orient: "horizontal", height: 18, bottom: 8 }),
        brushSelect: true,
        showDetail: false,
      });
    }
  }

  return result;
}

function gridWithInteractionSpace(
  grid: EChartsOption["grid"],
  zoom?: ZoomConfig,
) {
  if (!zoom || !(zoom.slider ?? true)) return grid;
  const source = (grid ?? {}) as {
    bottom?: number | string;
    right?: number | string;
  };
  const result = { ...source };

  if (zoom.axis !== "y") {
    const bottom = typeof source.bottom === "number" ? source.bottom : 16;
    // The slider occupies its own row below the category-axis labels.
    result.bottom = Math.max(bottom + 36, 72);
  }
  if (zoom.axis === "y" || zoom.axis === "xy") {
    const right = typeof source.right === "number" ? source.right : 16;
    result.right = Math.max(right, 56);
  }
  return result;
}

export function enhanceChartOption(
  option: EChartsOption,
  interaction: {
    zoom?: ZoomConfig;
    brush?: BrushConfig;
    viewport: ChartViewport | null;
  },
): EChartsOption {
  const { zoom, brush, viewport } = interaction;
  return {
    ...option,
    aria: option.aria ?? { enabled: true },
    grid: gridWithInteractionSpace(option.grid, zoom),
    ...(zoom ? { dataZoom: zoomOptions(zoom, viewport) } : {}),
    ...(brush
      ? {
          brush: {
            toolbox: [brush.axis === "y" ? "lineY" : "lineX", "clear"],
            xAxisIndex: brush.axis === "x" ? 0 : undefined,
            yAxisIndex: brush.axis === "y" ? 0 : undefined,
            throttleType: "debounce",
            throttleDelay: 100,
          },
        }
      : {}),
  };
}
