import type { Meta, StoryObj } from "@storybook/react-vite";

import { Histogram } from "./Histogram";
import type { HistogramBin } from "./types";

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

function genNormal(n: number, mu: number, sigma: number, seed: number) {
  const rng = makeLCG(seed);
  const out: number[] = [];
  while (out.length < n) {
    const [z0, z1] = boxMuller(rng);
    out.push(mu + sigma * z0, mu + sigma * z1);
  }
  return out.slice(0, n);
}

function toBins(values: number[], binCount = 20): HistogramBin[] {
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  if (min === max) return [{ start: min - 0.5, end: max + 0.5, count: values.length }];
  const width = (max - min) / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), binCount - 1);
    bins[idx]!.count++;
  }
  return bins;
}

const meta = {
  title: "Charts/Histogram",
  component: Histogram,
  tags: ["autodocs"],
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: {
    title: "Processing time",
    bins: toBins(genNormal(400, 120, 25, 1)),
  },
};

export const Bimodal: Story = {
  args: {
    title: "Two activity modes",
    bins: toBins([...genNormal(200, 30, 6, 2), ...genNormal(200, 90, 10, 3)]),
  },
};

export const RightSkewed: Story = {
  args: {
    title: "Cost distribution",
    bins: toBins(genNormal(350, 0, 0.8, 4).map((z) => Math.exp(5 + z)), 25),
  },
};

export const AllMissing: Story = {
  args: {
    title: "No values",
    bins: [],
  },
};
