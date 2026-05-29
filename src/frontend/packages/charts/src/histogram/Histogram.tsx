import { Skeleton, Stack } from "@mantine/core";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";

import { ChartCard } from "../ChartCard";
import { EChartCard } from "../EChartCard";
import type { ChartPoint, ChartViewport } from "../types";
import { histogramOption } from "./chartOptions";
import { HistogramDrillDownPanel } from "./HistogramDrillDownPanel";
import { HistogramFooter } from "./HistogramFooter";
import { HistogramSettings } from "./HistogramSettings";
import type { HistogramBin, HistogramData, HistogramRange } from "./types";

export interface HistogramProps {
  // Chrome passthrough
  title: string;
  subtitle?: string;
  info?: string;
  filename?: string;
  compact?: boolean;
  height?: number | string;

  // Controlled state — parent owns the source of truth.
  data: HistogramData | null;
  bins: number | null;
  range: HistogramRange;

  // Events
  onBinsChange: (bins: number | null) => void;
  onRangeChange: (range: HistogramRange) => void;

  // Drill-down: controlled bin selection + a render slot for the panel body.
  // The chart owns the open/close lifecycle and the panel chrome; the consumer
  // provides whatever should live inside the panel.
  selectedBin?: HistogramBin | null;
  onSelectedBinChange?: (bin: HistogramBin | null) => void;
  renderDrillDown?: (bin: HistogramBin) => ReactNode;
}

const RANGE_EPSILON = 1e-9;

export function Histogram({
  title,
  subtitle,
  info,
  filename,
  compact,
  height,
  data,
  bins,
  range,
  onBinsChange,
  onRangeChange,
  selectedBin = null,
  onSelectedBinChange,
  renderDrillDown,
}: HistogramProps) {
  const sharedChrome = { title, subtitle, info, compact, height };

  const option = useMemo(() => (data ? histogramOption(data) : null), [data]);

  // The viewport always tracks what the *data* covers, the chart shows what
  // we asked for and got. Parent's `range` drives the request; `data.covered`
  // drives the visualization.
  const viewport = useMemo<ChartViewport | null>(() => {
    if (!data) return null;
    const { domain, covered } = data;
    const fullView =
      Math.abs(covered.min - domain.min) < RANGE_EPSILON &&
      Math.abs(covered.max - domain.max) < RANGE_EPSILON;
    if (fullView) return null;
    return { x: { min: covered.min, max: covered.max } };
  }, [data]);

  void range;

  const handleViewportChange = useCallback(
    (next: ChartViewport | null) => {
      if (!data) return;
      const { domain } = data;
      if (next == null || !next.x) {
        onRangeChange({ min: null, max: null });
        return;
      }
      const lo = next.x.min;
      const hi = next.x.max;
      onRangeChange({
        min: lo - domain.min <= RANGE_EPSILON ? null : lo,
        max: domain.max - hi <= RANGE_EPSILON ? null : hi,
      });
    },
    [data, onRangeChange],
  );

  const handlePointClick = useCallback(
    (point: ChartPoint) => {
      if (!onSelectedBinChange || !data) return;
      const bin = data.bins[point.dataIndex];
      if (bin) onSelectedBinChange(bin);
    },
    [onSelectedBinChange, data],
  );

  // Loading state.
  if (data == null) {
    return (
      <ChartCard {...sharedChrome}>
        <Skeleton h="100%" />
      </ChartCard>
    );
  }

  const settings = (
    <HistogramSettings
      bins={bins}
      onBinsChange={onBinsChange}
      autoBins={bins === null ? data.bins.length : null}
    />
  );

  const chart = (
    <EChartCard
      {...sharedChrome}
      filename={filename}
      option={option!}
      settings={settings}
      note={<HistogramFooter data={data} />}
      zoom={{ axis: "x", slider: true, mouse: true }}
      viewport={viewport}
      onViewportChange={handleViewportChange}
      onPointClick={handlePointClick}
    />
  );

  const showDrillDown =
    selectedBin != null && renderDrillDown != null && onSelectedBinChange != null;

  if (!showDrillDown) return chart;

  return (
    <Stack gap="md">
      {chart}
      <HistogramDrillDownPanel onClose={() => onSelectedBinChange(null)}>
        {renderDrillDown(selectedBin)}
      </HistogramDrillDownPanel>
    </Stack>
  );
}
