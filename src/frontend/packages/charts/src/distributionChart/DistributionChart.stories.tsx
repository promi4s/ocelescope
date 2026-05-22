import type { Meta, StoryObj } from "@storybook/react-vite";
import { DistributionChart } from "./DistributionChart";

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

const meta = {
  title: "Charts/DistributionChart",
  component: DistributionChart,
  tags: ["autodocs"],
} satisfies Meta<typeof DistributionChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: {
    title: "Processing time",
    data: {
      values: genNormal(400, 120, 25, 1),
      missingCount: 12,
      totalCount: 412,
      unit: "s",
    },
  },
};

export const Bimodal: Story = {
  args: {
    title: "Two activity modes",
    data: {
      values: [...genNormal(200, 30, 6, 2), ...genNormal(200, 90, 10, 3)],
      missingCount: 0,
      totalCount: 400,
    },
  },
};

export const RightSkewed: Story = {
  args: {
    title: "Cost distribution",
    data: {
      values: genNormal(350, 0, 0.8, 4).map((z) => Math.exp(5 + z)),
      missingCount: 28,
      totalCount: 378,
      unit: "€",
    },
  },
};

export const Uniform: Story = {
  args: {
    title: "Random delays",
    data: {
      values: Array.from({ length: 300 }, (_, i) => makeLCG(5 + i * 17)() * 60),
      missingCount: 0,
      totalCount: 300,
      unit: "min",
    },
  },
};

export const AllMissing: Story = {
  args: {
    title: "No values",
    data: {
      values: [],
      missingCount: 50,
      totalCount: 50,
    },
  },
};

export const SingleValue: Story = {
  args: {
    title: "Single distinct value",
    data: {
      values: Array(100).fill(42) as number[],
      missingCount: 0,
      totalCount: 100,
    },
  },
};
