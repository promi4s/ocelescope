import { fmtNum, safeMax, safeMin, stddev } from "./stats";
import type { HistBin } from "./types";

export function scottBinCount(values: number[]): number {
  if (values.length < 2) return 1;

  const sd = stddev(values);
  const min = safeMin(values);
  const max = safeMax(values);

  if (sd === 0 || min === max) return 1;

  const width = 3.5 * sd * values.length ** (-1 / 3);
  const count = Math.ceil((max - min) / width);

  return Math.max(2, Math.min(100, count));
}

export function computeHistogram(
  values: number[],
  binCount: number,
): HistBin[] {
  const min = safeMin(values);
  const max = safeMax(values);
  const n = values.length;

  if (min === max || binCount < 1) {
    return [
      {
        lower: min - 0.5,
        upper: max + 0.5,
        center: min,
        count: n,
        density: n,
        label: fmtNum(min),
      },
    ];
  }

  const width = (max - min) / binCount;

  const bins: HistBin[] = Array.from({ length: binCount }, (_, index) => {
    const lower = min + index * width;
    const upper = lower + width;

    return {
      lower,
      upper,
      center: (lower + upper) / 2,
      count: 0,
      density: 0,
      label: fmtNum(lower),
    };
  });

  for (const value of values) {
    let index = Math.floor((value - min) / width);

    if (index >= binCount) index = binCount - 1;
    if (index >= 0) bins[index]!.count++;
  }

  for (const bin of bins) {
    bin.density = bin.count / (n * width);
  }

  return bins;
}
