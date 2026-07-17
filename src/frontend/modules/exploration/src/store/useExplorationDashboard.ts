import { useEffect, useState } from "react";
import type {
  ActivityExecutionFrequencySpec,
  DashboardCardDefinition,
  ObjectInvolvementDistributionSpec,
  StoredDashboard,
} from "../model/dashboard";

const storageKey = (ocelId: string) => `ocelescope:exploration:${ocelId}`;

function isStoredDashboard(value: unknown): value is StoredDashboard {
  if (!value || typeof value !== "object") return false;
  const dashboard = value as Partial<StoredDashboard>;
  return dashboard.version === 1 && Array.isArray(dashboard.cards);
}

function migrateCards(cards: DashboardCardDefinition[]) {
  return cards.map((card) => {
    const analysis = (card.spec as { analysis: string }).analysis;
    if (analysis === "activity-executions-per-object") {
      return {
        ...card,
        spec: {
          ...card.spec,
          analysis: "activity-execution-frequency",
        } as ActivityExecutionFrequencySpec,
      };
    }
    if (analysis === "object-involvement-distribution") {
      const spec = card.spec as unknown as {
        query: { activity: string; object_type: string; grouping?: unknown };
        visualization?: unknown;
        title?: string;
      };
      if (spec.query.grouping && spec.visualization) return card;
      return {
        ...card,
        spec: {
          ...spec,
          query: {
            ...spec.query,
            grouping: { kind: "categories", limit: 500 },
          },
          visualization: "bar",
        } as ObjectInvolvementDistributionSpec,
      };
    }
    return card;
  });
}

export function useExplorationDashboard(ocelId: string) {
  const [cards, setCards] = useState<DashboardCardDefinition[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    try {
      const stored = window.localStorage.getItem(storageKey(ocelId));
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      setCards(isStoredDashboard(parsed) ? migrateCards(parsed.cards) : []);
    } catch {
      setCards([]);
    }
    setLoaded(true);
  }, [ocelId]);

  useEffect(() => {
    if (!loaded) return;
    const dashboard: StoredDashboard = { version: 1, cards };
    try {
      window.localStorage.setItem(
        storageKey(ocelId),
        JSON.stringify(dashboard),
      );
    } catch {
      // The dashboard remains usable when browser storage is unavailable.
    }
  }, [cards, loaded, ocelId]);

  return { cards, setCards, loaded };
}
