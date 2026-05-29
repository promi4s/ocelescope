import type { NumericRange } from "../types";

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface HistogramData {
  bins: HistogramBin[];
  /** Full attribute extent — slider/zoom-out limit. */
  domain: NumericRange;
  /** Range these bins were computed over. */
  covered: NumericRange;
  counts: {
    covered: number;
    missing: number;
    total: number;
  };
}

export interface HistogramRange {
  /** `null` means "unbounded on this side" (clamped to the data domain by the producer). */
  min: number | null;
  max: number | null;
}
