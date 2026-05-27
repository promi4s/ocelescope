import type { Meta, StoryObj } from "@storybook/react-vite";

import { BarChart } from "./BarChart";

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {
  args: {
    title: "Events per activity",
    data: {
      categories: ["Create Order", "Pack Items", "Ship Order", "Deliver", "Return"],
      series: [{ name: "Count", data: [412, 398, 380, 371, 42] }],
    },
  },
};

export const MultiSeries: Story = {
  args: {
    title: "Events per activity by object type",
    data: {
      categories: ["Create Order", "Pack Items", "Ship Order", "Deliver", "Return"],
      series: [
        { name: "Orders", data: [412, 398, 380, 371, 42] },
        { name: "Items", data: [824, 810, 795, 780, 91] },
        { name: "Packages", data: [380, 372, 369, 360, 38] },
      ],
    },
  },
};

export const Stacked: Story = {
  args: {
    title: "Events per activity (stacked)",
    data: {
      categories: ["Create Order", "Pack Items", "Ship Order", "Deliver", "Return"],
      series: [
        { name: "Orders", data: [412, 398, 380, 371, 42] },
        { name: "Items", data: [824, 810, 795, 780, 91] },
        { name: "Packages", data: [380, 372, 369, 360, 38] },
      ],
    },
    stacked: true,
  },
};

export const Horizontal: Story = {
  args: {
    title: "Top object types",
    data: {
      categories: ["Orders", "Items", "Packages", "Suppliers", "Warehouses"],
      series: [{ name: "Count", data: [1240, 5820, 980, 45, 12] }],
    },
    horizontal: true,
  },
};

export const ManyCategories: Story = {
  args: {
    title: "Attribute value distribution",
    data: {
      categories: Array.from({ length: 15 }, (_, i) => `Category ${i + 1}`),
      series: [
        { name: "Series A", data: Array.from({ length: 15 }, (_, i) => Math.round(100 + i * 17 - (i * i) / 2)) },
        { name: "Series B", data: Array.from({ length: 15 }, (_, i) => Math.round(200 - i * 10)) },
      ],
    },
  },
};
