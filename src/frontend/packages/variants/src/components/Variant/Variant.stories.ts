import { faker } from "@faker-js/faker";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Variant } from "./Variant";

faker.seed(4);

const meta = {
  title: "Variant",
  component: Variant,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Variant>;

export default meta;
type Story = StoryObj<typeof meta>;

const generateVariant = (length: number) => {
  const activityArrays = Array.from({ length: 5 }).map(() =>
    faker.lorem.word(),
  );

  return Array.from({ length: 10 }).map(() =>
    faker.helpers.arrayElement(activityArrays),
  );
};

export const Default: Story = {
  args: { variant: generateVariant(10) },
};

export const Grouped: Story = {
  args: { variant: generateVariant(10), enableGrouping: true },
};
