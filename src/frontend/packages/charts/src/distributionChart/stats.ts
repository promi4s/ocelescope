export function safeMin(values: number[]): number {
  return values.reduce((min, value) => (value < min ? value : min), Infinity);
}

export function safeMax(values: number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), -Infinity);
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function stddev(values: number[]): number {
  const mu = mean(values);

  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mu) ** 2, 0) / values.length,
  );
}

export function fmtNum(value: number): string {
  if (!Number.isFinite(value)) return String(value);

  const abs = Math.abs(value);

  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2);
  if (Number.isInteger(value)) return String(value);

  return value.toPrecision(4).replace(/\.?0+$/, "");
}
