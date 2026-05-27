import type { Meta, StoryObj } from "@storybook/react-vite";

import type { LinePoint } from "../lineChart/types";
import type { ViolinStats } from "./types";
import { ViolinChart } from "./ViolinChart";

function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s >>>= 0;
    return s / 0x100000000;
  };
}

function boxMuller(rng: () => number): [number, number] {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const r = Math.sqrt(-2 * Math.log(u1));
  return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
}

function genNormal(n: number, mu: number, sigma: number, seed: number): number[] {
  const rng = makeLCG(seed);
  const out: number[] = [];
  while (out.length < n) {
    const [z0, z1] = boxMuller(rng);
    out.push(mu + sigma * z0, mu + sigma * z1);
  }
  return out.slice(0, n).sort((a, b) => a - b);
}

function computeStats(sorted: number[]): ViolinStats {
  const n = sorted.length;
  const q = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
  };
  return {
    min: sorted[0]!,
    max: sorted[n - 1]!,
    q1: q(0.25),
    median: q(0.5),
    q3: q(0.75),
  };
}

function gaussianKDE(values: number[], nPoints = 200): LinePoint[] {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const h = 1.06 * std * n ** -0.2;
  const min = values[0]! - 3 * h;
  const max = values[values.length - 1]! + 3 * h;
  return Array.from({ length: nPoints }, (_, i) => {
    const x = min + (i / (nPoints - 1)) * (max - min);
    const y =
      values.reduce((s, v) => s + Math.exp(-0.5 * ((x - v) / h) ** 2), 0) /
      (n * h * Math.sqrt(2 * Math.PI));
    return { x, y };
  });
}

function makeViolin(
  mu: number,
  sigma: number,
  seed: number,
): { points: LinePoint[]; stats: ViolinStats } {
  const samples = genNormal(400, mu, sigma, seed);
  return { points: gaussianKDE(samples), stats: computeStats(samples) };
}

const meta = {
  title: "Charts/ViolinChart",
  component: ViolinChart,
  tags: ["autodocs"],
} satisfies Meta<typeof ViolinChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: {
    title: "Processing time",
    ...makeViolin(120, 25, 1),
  },
};

export const Narrow: Story = {
  args: {
    title: "Tight distribution",
    ...makeViolin(50, 5, 2),
  },
};

export const RightSkewed: Story = {
  args: {
    title: "Cost distribution",
    ...(() => {
      const raw = genNormal(350, 0, 0.8, 4).map((z) => Math.exp(5 + z)).sort((a, b) => a - b);
      return { points: gaussianKDE(raw), stats: computeStats(raw) };
    })(),
  },
};
