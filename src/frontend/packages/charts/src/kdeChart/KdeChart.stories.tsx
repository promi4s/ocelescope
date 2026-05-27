import type { Meta, StoryObj } from "@storybook/react-vite";

import { KdeChart } from "./KdeChart";
import type { LinePoint } from "../lineChart/types";

function gaussian(mu: number, sigma: number, n = 200): LinePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const x = mu - 4 * sigma + (i / (n - 1)) * 8 * sigma;
    const y = Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
    return { x, y };
  });
}

const meta = {
  title: "Charts/KdeChart",
  component: KdeChart,
  tags: ["autodocs"],
} satisfies Meta<typeof KdeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: {
    title: "Processing time",
    points: gaussian(120, 25),
  },
};

export const Narrow: Story = {
  args: {
    title: "Tight distribution",
    points: gaussian(50, 5),
  },
};
