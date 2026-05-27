import type { Meta, StoryObj } from "@storybook/react-vite";

import { LineChart } from "./LineChart";
import type { LineSeries } from "./types";

function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s >>>= 0;
    return s / 0x100000000;
  };
}

function makeKDE(mu: number, sigma: number, n = 100): LineSeries {
  const points = Array.from({ length: n }, (_, i) => {
    const x = mu - 4 * sigma + (i / (n - 1)) * 8 * sigma;
    const y = Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
    return { x, y };
  });
  return { name: `μ=${mu}, σ=${sigma}`, points, smooth: true, area: true };
}

function makeSine(amplitude: number, frequency: number, phase: number, n = 80): LineSeries {
  const rng = makeLCG(42);
  const points = Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * 4 * Math.PI;
    const y = amplitude * Math.sin(frequency * x + phase) + (rng() - 0.5) * amplitude * 0.2;
    return { x, y };
  });
  return { name: `A=${amplitude} f=${frequency}`, points, smooth: true };
}

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleKDE: Story = {
  args: {
    title: "Density estimate — processing time",
    series: [makeKDE(120, 25)],
  },
};

export const MultiKDE: Story = {
  args: {
    title: "Density estimates — two activity modes",
    series: [makeKDE(30, 6), makeKDE(90, 10)],
  },
};

export const SmoothLine: Story = {
  args: {
    title: "Metric over time",
    series: [makeSine(1, 1, 0, 60), makeSine(0.8, 1.5, Math.PI / 4, 60)],
  },
};

export const AreaFill: Story = {
  args: {
    title: "KDE with area fill",
    series: [{ ...makeKDE(100, 20), area: true, smooth: true }],
  },
};
