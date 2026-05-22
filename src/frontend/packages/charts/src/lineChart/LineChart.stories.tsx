import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart } from "./LineChart";

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AttributeDevelopment: Story = {
  args: {
    title: "Order value over time",
    xType: "time",
    unit: "€",
    series: [
      {
        name: "Order-001",
        data: [
          ["2024-01-01T08:00:00", 0],
          ["2024-01-03T10:30:00", 150],
          ["2024-01-07T14:00:00", 320],
          ["2024-01-10T09:15:00", 320],
          ["2024-01-12T16:45:00", 480],
        ],
      },
      {
        name: "Order-002",
        data: [
          ["2024-01-02T11:00:00", 0],
          ["2024-01-05T08:45:00", 200],
          ["2024-01-08T13:30:00", 200],
          ["2024-01-11T10:00:00", 550],
        ],
      },
      {
        name: "Order-003",
        data: [
          ["2024-01-04T09:00:00", 0],
          ["2024-01-06T15:00:00", 90],
          ["2024-01-09T11:30:00", 310],
          ["2024-01-13T08:00:00", 310],
        ],
      },
    ],
  },
};

export const NumericX: Story = {
  args: {
    title: "Queue length over iterations",
    xType: "value",
    xLabel: "Iteration",
    yLabel: "Queue length",
    series: [
      {
        name: "Worker A",
        data: Array.from({ length: 20 }, (_, i) => [i, Math.round(5 + Math.sin(i * 0.5) * 4)] as [number, number]),
      },
      {
        name: "Worker B",
        data: Array.from({ length: 20 }, (_, i) => [i, Math.round(3 + Math.cos(i * 0.4) * 3)] as [number, number]),
      },
    ],
  },
};

export const SingleSeries: Story = {
  args: {
    title: "Package weight development",
    xType: "time",
    unit: "kg",
    series: [
      {
        name: "Package-007",
        data: [
          ["2024-02-01T08:00:00", 2.4],
          ["2024-02-03T12:00:00", 5.1],
          ["2024-02-05T09:30:00", 5.1],
          ["2024-02-07T14:00:00", 8.3],
        ],
      },
    ],
  },
};
