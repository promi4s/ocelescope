import { useCallback, useState } from "react";
import type { ChartSelection } from "./types";

/** Navigation state only: the consumer decides whether to filter locally or fetch. */
export function useChartDrilldown() {
  const [path, setPath] = useState<ChartSelection[]>([]);
  const onSelect = useCallback((selection: ChartSelection) => {
    setPath((previous) => [...previous, selection]);
  }, []);
  const back = useCallback(
    () => setPath((previous) => previous.slice(0, -1)),
    [],
  );
  const reset = useCallback(() => setPath([]), []);
  return {
    path,
    current: path.at(-1) ?? null,
    canGoBack: path.length > 0,
    onSelect,
    back,
    reset,
  };
}
