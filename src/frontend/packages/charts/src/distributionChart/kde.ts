import { stddev } from "./stats";

export function silvermanBandwidth(values: number[]): number {
  if (values.length < 2) return 1;

  const sd = stddev(values);

  if (sd === 0) return 1;

  return 1.06 * sd * values.length ** -0.2;
}

export function gaussianKDE(
  values: number[],
  bandwidth: number,
  points: number[],
): number[] {
  const n = values.length;
  const normalizer = 1 / Math.sqrt(2 * Math.PI);

  return points.map((x) => {
    let sum = 0;

    for (const value of values) {
      const u = (x - value) / bandwidth;
      sum += normalizer * Math.exp(-0.5 * u * u);
    }

    return sum / (n * bandwidth);
  });
}
