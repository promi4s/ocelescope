import type ReactEChartsType from "echarts-for-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  BrushConfig,
  ChartEventMap,
  ChartPoint,
  ChartViewport,
  ZoomConfig,
} from "./types";

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

function readViewport(ref: RefObject<ReactEChartsType | null>) {
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
  chartRef: RefObject<ReactEChartsType | null>;
  zoom?: ZoomConfig;
  brush?: BrushConfig;
  viewport?: ChartViewport | null;
  onViewportChange?: (viewport: ChartViewport | null) => void;
  onSelection?: (selection: ChartViewport | null) => void;
  onPointClick?: (point: ChartPoint) => void;
  onEvents?: ChartEventMap;
}

export function useEChartInteractions({
  chartRef,
  zoom,
  brush,
  viewport: controlledViewport,
  onViewportChange,
  onSelection,
  onPointClick,
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

    if (onPointClick) {
      composeHandler(result, "click", (...args) => {
        const parameters = args[0] as {
          dataIndex?: number;
          value?: unknown;
          seriesName?: string;
        };
        if (parameters.dataIndex == null) return;
        onPointClick({
          dataIndex: parameters.dataIndex,
          value: parameters.value,
          seriesName: parameters.seriesName,
        });
      });
    }
    return result;
  }, [
    brush,
    chartRef,
    controlled,
    onEvents,
    onPointClick,
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
