import type { HistogramData } from "@ocelescope/charts";

import type { HistogramSchema } from "../../api/base";

/**
 * The backend already returns the chart-layer shape — this mapper exists so
 * the consumer code never needs to know about the API type and so the
 * `null` handling for the empty-attribute case lives in one place.
 */
export function toHistogramData(schema: HistogramSchema): HistogramData | null {
  if (!schema.domain) return null;
  const covered = schema.covered ?? schema.domain;
  return {
    bins: schema.bins.map((b) => ({
      start: b.start,
      end: b.end,
      count: b.count,
    })),
    domain: { min: schema.domain.min, max: schema.domain.max },
    covered: { min: covered.min, max: covered.max },
    counts: {
      covered: schema.counts.covered,
      missing: schema.counts.missing,
      total: schema.counts.total,
    },
  };
}
