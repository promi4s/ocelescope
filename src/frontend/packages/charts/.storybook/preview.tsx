import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  decorators: [
    (Story) => (
      <MantineProvider>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default preview;
