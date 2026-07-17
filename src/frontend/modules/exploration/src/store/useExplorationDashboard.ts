import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChartSpec } from "../model/chartSpec";
import { isChartSpec } from "../model/chartSpec";

const STORAGE_VERSION = "v4";

export function useExplorationDashboard(ocelId: string) {
  const storageKey = useMemo(
    () => `ocelescope.exploration.dashboard.${STORAGE_VERSION}.${ocelId}`,
    [ocelId],
  );
  const [charts, setCharts] = useState<ChartSpec[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isChartSpec);
          setCharts(valid);
          setReady(true);
          return;
        }
      }
    } catch {
      // Invalid local state falls back to a fresh dashboard.
    }
    setCharts([]);
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(storageKey, JSON.stringify(charts));
  }, [charts, ready, storageKey]);

  const saveChart = useCallback((spec: ChartSpec) => {
    setCharts((current) => {
      const index = current.findIndex((chart) => chart.id === spec.id);
      if (index < 0) return [...current, spec];
      return current.map((chart) => (chart.id === spec.id ? spec : chart));
    });
  }, []);

  const removeChart = useCallback((id: string) => {
    setCharts((current) => current.filter((chart) => chart.id !== id));
  }, []);

  const resetDashboard = useCallback(() => {
    setCharts([]);
  }, []);

  return { charts, ready, saveChart, removeChart, resetDashboard };
}
