import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "./BarChart";

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {
  args: {
    title: "Activity executions per object type",
    categories: ["Order", "Item", "Package", "Customer"],
    valueLabel: "Executions",
    series: [
      { name: "Place Order", data: [400, 0, 0, 380] },
      { name: "Pick Item", data: [350, 350, 210, 0] },
      { name: "Send Package", data: [270, 0, 280, 0] },
      { name: "Pay Order", data: [170, 0, 0, 165] },
    ],
  },
};

export const Stacked: Story = {
  args: {
    ...Grouped.args,
    title: "Activity executions per object type (stacked)",
    stacked: true,
  },
};

export const StackedHorizontal: Story = {
  args: {
    title: "Object type combinations",
    stacked: true,
    orientation: "horizontal",
    categories: ["Order+Item", "Order+Package", "Order+Item+Package"],
    categoryMeta: ["Order, Item", "Order, Package", "Order, Item, Package"],
    valueLabel: "Events",
    series: [
      { name: "Pick Item", data: [350, 0, 120] },
      { name: "Send Package", data: [0, 280, 120] },
    ],
  },
};

export const Single: Story = {
  args: {
    title: "Events per activity",
    categories: ["Place Order", "Pick Item", "Send Package", "Pay Order"],
    series: [{ name: "Count", data: [400, 350, 280, 170] }],
  },
};
