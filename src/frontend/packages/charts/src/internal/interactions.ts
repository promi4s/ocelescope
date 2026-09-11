import type { EChartsOption } from "echarts";
import type EChartsReactCore from "echarts-for-react/lib/core";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BrushConfig, ChartViewport, ZoomConfig } from "../types";
import type { ChartEventMap } from "./engine";

const EPSILON = 1e-9;

function sameViewport(
  first: ChartViewport | null,
  second: ChartViewport | null,
) {
  if (first == null || second == null) return first === second;
  return (["x", "y"] as const).every((axis) => {
    const a = first[axis];
    const b = second[axis];
    if (!a || !b) return a === b;
    return (
      Math.abs(a.min - b.min) < EPSILON && Math.abs(a.max - b.max) < EPSILON
    );
  });
}

function readViewport(ref: RefObject<EChartsReactCore | null>) {
  const option = ref.current?.getEchartsInstance().getOption() as
    | {
        dataZoom?: Array<{
          id?: string;
          start?: number;
          end?: number;
        }>;
      }
    | undefined;
  const viewport: ChartViewport = {};
  for (const zoom of option?.dataZoom ?? []) {
    if (zoom.start == null || zoom.end == null) continue;
    const axis = zoom.id?.endsWith("-y") ? "y" : "x";
    viewport[axis] = { min: zoom.start, max: zoom.end };
  }
  return viewport.x || viewport.y ? viewport : null;
}

function composeHandler(
  events: ChartEventMap,
  name: string,
  internal: (...args: unknown[]) => void,
) {
  const external = events[name];
  events[name] = (...args) => {
    internal(...args);
    external?.(...args);
  };
}

interface UseEChartInteractionsOptions {
  chartRef: RefObject<EChartsReactCore | null>;
  zoom?: ZoomConfig;
  brush?: BrushConfig;
  viewport?: ChartViewport | null;
  onViewportChange?: (viewport: ChartViewport | null) => void;
  onSelection?: (selection: ChartViewport | null) => void;
  onEvents?: ChartEventMap;
}

export function useEChartInteractions({
  chartRef,
  zoom,
  brush,
  viewport: controlledViewport,
  onViewportChange,
  onSelection,
  onEvents,
}: UseEChartInteractionsOptions) {
  const controlled = controlledViewport !== undefined;
  const [internalViewport, setInternalViewport] =
    useState<ChartViewport | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const lastEmitted = useRef<ChartViewport | null>(controlledViewport ?? null);
  const viewport = controlled ? (controlledViewport ?? null) : internalViewport;

  useEffect(() => {
    if (controlled && !sameViewport(lastEmitted.current, viewport)) {
      lastEmitted.current = viewport;
    }
  }, [controlled, viewport]);

  const events = useMemo(() => {
    const result: ChartEventMap = { ...onEvents };

    if (zoom) {
      composeHandler(result, "datazoom", () => {
        const next = readViewport(chartRef);
        if (sameViewport(lastEmitted.current, next)) return;
        lastEmitted.current = next;
        if (!controlled) setInternalViewport(next);
        onViewportChange?.(next);
      });
    }

    if (brush) {
      composeHandler(result, "brushEnd", (...args) => {
        const parameters = args[0] as {
          areas?: Array<{ coordRange?: [number, number] }>;
        };
        const range = parameters.areas?.[0]?.coordRange;
        if (!range) {
          setHasSelection(false);
          onSelection?.(null);
          return;
        }
        const selection = {
          [brush.axis]: {
            min: Math.min(...range),
            max: Math.max(...range),
          },
        };
        setHasSelection(true);
        onSelection?.(selection);
      });
    }

    return result;
  }, [
    brush,
    chartRef,
    controlled,
    onEvents,
    onSelection,
    onViewportChange,
    zoom,
  ]);

  const reset = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (zoom) {
      instance?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
      lastEmitted.current = null;
      if (!controlled) setInternalViewport(null);
      onViewportChange?.(null);
    }
    if (brush && hasSelection) {
      instance?.dispatchAction({ type: "brush", areas: [] });
      setHasSelection(false);
      onSelection?.(null);
    }
  }, [
    brush,
    chartRef,
    controlled,
    hasSelection,
    onSelection,
    onViewportChange,
    zoom,
  ]);

  return {
    events,
    viewport,
    canReset: viewport != null || hasSelection,
    reset,
  };
}

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
