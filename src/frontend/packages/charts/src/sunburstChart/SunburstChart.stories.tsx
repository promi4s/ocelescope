import type { Meta, StoryObj } from "@storybook/react-vite";
import { SunburstChart } from "./SunburstChart";

const meta = {
  title: "Charts/SunburstChart",
  component: SunburstChart,
  tags: ["autodocs"],
} satisfies Meta<typeof SunburstChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ObjectInvolvement: Story = {
  args: {
    title: "Object involvement per activity",
    total: 1200,
    data: [
      {
        name: "Place Order",
        value: 400,
        children: [
          { name: "Order", value: 400 },
          { name: "Customer", value: 380 },
        ],
      },
      {
        name: "Pick Item",
        value: 350,
        children: [
          { name: "Order", value: 350 },
          { name: "Item", value: 350 },
          { name: "Package", value: 210 },
        ],
      },
      {
        name: "Send Package",
        value: 280,
        children: [
          { name: "Package", value: 280 },
          { name: "Order", value: 270 },
        ],
      },
      {
        name: "Pay Order",
        value: 170,
        children: [
          { name: "Order", value: 170 },
          { name: "Customer", value: 165 },
        ],
      },
    ],
  },
};

export const Minimal: Story = {
  args: {
    title: "Simple hierarchy",
    data: [
      { name: "A", value: 10 },
      { name: "B", value: 20 },
      { name: "C", value: 30 },
    ],
  },
};
