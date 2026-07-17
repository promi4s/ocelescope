import { useCallback, useState } from "react";

import type { ChartPoint, ChartViewport } from "./types";

export interface ChartInteractions {
  viewport: ChartViewport | null;
  selection: ChartViewport | null;
  selectedPoint: ChartPoint | null;
  onViewportChange: (viewport: ChartViewport | null) => void;
  onSelection: (selection: ChartViewport | null) => void;
  onPointClick: (point: ChartPoint) => void;
  resetInteractions: () => void;
}

export interface ChartInteractionDefaults {
  viewport?: ChartViewport | null;
  selection?: ChartViewport | null;
  selectedPoint?: ChartPoint | null;
}

export function useChartInteractions(
  defaults: ChartInteractionDefaults = {},
): ChartInteractions {
  const [viewport, setViewport] = useState<ChartViewport | null>(
    defaults.viewport ?? null,
  );
  const [selection, setSelection] = useState<ChartViewport | null>(
    defaults.selection ?? null,
  );
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(
    defaults.selectedPoint ?? null,
  );

  const resetInteractions = useCallback(() => {
    setViewport(null);
    setSelection(null);
    setSelectedPoint(null);
  }, []);

  return {
    viewport,
    selection,
    selectedPoint,
    onViewportChange: setViewport,
    onSelection: setSelection,
    onPointClick: setSelectedPoint,
    resetInteractions,
  };
}
