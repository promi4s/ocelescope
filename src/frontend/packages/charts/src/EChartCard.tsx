import { ActionIcon, Modal, Tooltip } from "@mantine/core";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type ReactEChartsType from "echarts-for-react";
import { DownloadIcon, Maximize2Icon, RotateCcwIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { ChartCard } from "./ChartCard";
import type { BrushConfig, ChartPoint, ChartViewport, ZoomConfig } from "./types";

export interface EChartCardProps {
  // Identity / chrome
  title: string;
  subtitle?: string;
  info?: string;
  filename?: string;

  controls?: React.ReactNode;
  settings?: React.ReactNode;
  actions?: React.ReactNode;
  note?: React.ReactNode;

  compact?: boolean;
  height?: number | string;

  expandable?: boolean;
  expandedHeight?: number | string;

  // Chart definition
  option: EChartsOption;

  // Generic interactivity (opt-in)
  zoom?: ZoomConfig;
  brush?: BrushConfig;

  // Controlled viewport (zoom/pan state)
  viewport?: ChartViewport | null;
  onViewportChange?: (viewport: ChartViewport | null) => void;

  // Brush selection state (not controlled — emitted on settle)
  onSelection?: (selection: ChartViewport | null) => void;

  // Drill-down / data point clicks
  onPointClick?: (point: ChartPoint) => void;
}

const VIEWPORT_EPSILON = 1e-9;

function approxEqRange(a: ChartViewport | null | undefined, b: ChartViewport | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const ax = a.x;
  const bx = b.x;
  if (!ax && !bx) return true;
  if (!ax || !bx) return false;
  return (
    Math.abs(ax.min - bx.min) < VIEWPORT_EPSILON &&
    Math.abs(ax.max - bx.max) < VIEWPORT_EPSILON
  );
}

interface DataZoomOption {
  id: string;
  type: "inside" | "slider";
  xAxisIndex?: 0;
  yAxisIndex?: 0;
  startValue?: number;
  endValue?: number;
  start?: number;
  end?: number;
  height?: number;
  bottom?: number;
  brushSelect?: boolean;
  showDetail?: boolean;
  throttle?: number;
}

function buildDataZoom(zoom: ZoomConfig, viewport: ChartViewport | null | undefined): DataZoomOption[] {
  const axis = zoom.axis ?? "x";
  const slider = zoom.slider ?? true;
  const mouse = zoom.mouse ?? true;

  const axisProp = axis === "y" ? "yAxisIndex" : "xAxisIndex";
  const result: DataZoomOption[] = [];

  const range = axis === "y" ? viewport?.y : viewport?.x;
  const rangeProps = range
    ? { startValue: range.min, endValue: range.max }
    : { start: 0, end: 100 };

  if (mouse) {
    result.push({
      id: `zoom-inside-${axis}`,
      type: "inside",
      [axisProp]: 0,
      throttle: 50,
      ...rangeProps,
    });
  }
  if (slider) {
    result.push({
      id: `zoom-slider-${axis}`,
      type: "slider",
      [axisProp]: 0,
      height: 18,
      bottom: 8,
      brushSelect: true,
      showDetail: false,
      ...rangeProps,
    });
  }

  return result;
}

interface BrushBatch {
  areas: Array<{
    coordRange?: [number, number];
  }>;
}

interface DataZoomEventBatch {
  startValue?: number;
  endValue?: number;
}

interface ChartClickParams {
  dataIndex: number;
  value: unknown;
  seriesName?: string;
}

export function EChartCard({
  title,
  subtitle,
  info,
  filename = "chart",
  controls,
  settings,
  actions,
  note,
  compact,
  height,
  expandable = true,
  expandedHeight = 620,
  option,
  zoom,
  brush,
  viewport = null,
  onViewportChange,
  onSelection,
  onPointClick,
}: EChartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const chartRef = useRef<ReactEChartsType>(null);

  // Track the last viewport we emitted so we can suppress echoes from
  // programmatic option updates that re-fire `datazoom`.
  const lastEmittedViewport = useRef<ChartViewport | null>(viewport ?? null);

  const mergedOption = useMemo<EChartsOption>(() => {
    const merged: EChartsOption = { ...option };

    if (zoom) {
      // Bump bottom inset so the slider does not overlap axis labels.
      const grid = (option.grid ?? {}) as { bottom?: number | string };
      const wantsSlider = zoom.slider ?? true;
      if (wantsSlider) {
        const currentBottom =
          typeof grid.bottom === "number" ? grid.bottom : 16;
        merged.grid = { ...grid, bottom: Math.max(currentBottom, 56) };
      }
      merged.dataZoom = buildDataZoom(zoom, viewport);
    }

    if (brush) {
      const brushType = brush.axis === "y" ? "lineY" : "lineX";
      merged.brush = {
        toolbox: [brushType, "clear"],
        xAxisIndex: brush.axis === "x" ? 0 : undefined,
        yAxisIndex: brush.axis === "y" ? 0 : undefined,
        throttleType: "debounce",
        throttleDelay: 100,
      };
    }

    return merged;
  }, [option, zoom, brush, viewport]);

  const events = useMemo(() => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};

    if (zoom && onViewportChange) {
      handlers.datazoom = () => {
        const instance = chartRef.current?.getEchartsInstance();
        if (!instance) return;
        const fullOpt = instance.getOption() as { dataZoom?: DataZoomEventBatch[] };
        const dz = fullOpt.dataZoom?.[0];
        if (!dz || dz.startValue == null || dz.endValue == null) return;

        const newViewport: ChartViewport = {
          x: { min: dz.startValue, max: dz.endValue },
        };

        if (approxEqRange(lastEmittedViewport.current, newViewport)) return;
        lastEmittedViewport.current = newViewport;
        onViewportChange(newViewport);
      };
    }

    if (brush && onSelection) {
      handlers.brushEnd = (...args: unknown[]) => {
        const params = args[0] as { areas?: BrushBatch["areas"] };
        const area = params.areas?.[0];
        if (!area?.coordRange) {
          setHasSelection(false);
          onSelection(null);
          return;
        }
        const [a, b] = area.coordRange;
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        setHasSelection(true);
        onSelection(
          brush.axis === "y" ? { y: { min, max } } : { x: { min, max } },
        );
      };
    }

    if (onPointClick) {
      handlers.click = (...args: unknown[]) => {
        const params = args[0] as ChartClickParams;
        if (params == null || params.dataIndex == null) return;
        onPointClick({
          dataIndex: params.dataIndex,
          value: params.value,
          seriesName: params.seriesName,
        });
      };
    }

    return handlers;
  }, [zoom, brush, onViewportChange, onSelection, onPointClick]);

  // Keep our memory of the last emitted viewport in sync with the prop, so
  // controlled re-renders do not echo back through `onViewportChange`.
  if (!approxEqRange(lastEmittedViewport.current, viewport ?? null)) {
    lastEmittedViewport.current = viewport ?? null;
  }

  const handleDownload = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !filename) return;
    const url = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}.png`;
    anchor.click();
  }, [filename]);

  const handleReset = useCallback(() => {
    if (hasSelection) {
      const instance = chartRef.current?.getEchartsInstance();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance as any)?.dispatchAction?.({ type: "brush", areas: [] });
      setHasSelection(false);
      onSelection?.(null);
    }
    if (viewport != null) {
      lastEmittedViewport.current = null;
      onViewportChange?.(null);
    }
  }, [hasSelection, viewport, onSelection, onViewportChange]);

  const showReset = viewport != null || hasSelection;

  const extraActions = (
    <>
      {actions}

      {showReset && (
        <Tooltip label="Reset view">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={handleReset}
            aria-label="Reset chart view"
          >
            <RotateCcwIcon size={14} />
          </ActionIcon>
        </Tooltip>
      )}

      {expandable && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Open larger chart"
          onClick={() => setExpanded(true)}
        >
          <Maximize2Icon size={14} />
        </ActionIcon>
      )}

      {filename && (
        <ActionIcon
          variant="light"
          color="blue"
          size="md"
          aria-label="Download as PNG"
          onClick={handleDownload}
        >
          <DownloadIcon size={16} />
        </ActionIcon>
      )}
    </>
  );

  return (
    <>
      <ChartCard
        title={title}
        subtitle={subtitle}
        info={info}
        controls={controls}
        settings={settings}
        actions={extraActions}
        note={note}
        compact={compact}
        height={height}
      >
        <ReactECharts
          ref={chartRef}
          option={mergedOption}
          notMerge={false}
          lazyUpdate
          style={{ width: "100%", height: "100%" }}
          onEvents={events}
        />
      </ChartCard>

      <Modal
        opened={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        size="90vw"
        centered
      >
        {subtitle && (
          <div style={{ marginBottom: 12, color: "var(--mantine-color-dimmed)" }}>
            {subtitle}
          </div>
        )}

        <ReactECharts
          option={mergedOption}
          notMerge={false}
          lazyUpdate
          style={{ width: "100%", height: expandedHeight }}
        />
      </Modal>
    </>
  );
}
