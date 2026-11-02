import {
  Badge,
  Center,
  Group,
  LoadingOverlay,
  Stack,
  Text,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import { useResource } from "@ocelescope/api-base";
import { Visualization, type VisualizationsType } from "@ocelescope/resources";
import { EyeOffIcon } from "lucide-react";
import { type PluginOutput, useOcelVisualization } from "../../api/plugin";

const NoVisualization = ({ typeLabel }: { typeLabel: string }) => (
  <Center h="100%" p="md">
    <Stack align="center" gap="xs">
      <EyeOffIcon
        size={64}
        strokeWidth={1.5}
        color="var(--mantine-color-dimmed)"
      />
      <Text fw={500}>No visualization available</Text>
      <Group gap={6} justify="center">
        <Badge size="sm" color={generateColor(typeLabel)}>
          {typeLabel}
        </Badge>
        <Text size="sm" c="dimmed">
          does not provide a visualization
        </Text>
      </Group>
    </Stack>
  </Center>
);

const ResourceOutputVisualization = ({ output }: { output: PluginOutput }) => {
  const { data } = useResource(output.id);

  if (!data) {
    return <LoadingOverlay visible />;
  }

  if (!data.visualization) {
    return <NoVisualization typeLabel={output.type_label} />;
  }

  return (
    <Visualization visualization={data.visualization as VisualizationsType} />
  );
};

const OcelOutputVisualization = ({ output }: { output: PluginOutput }) => {
  const { data } = useOcelVisualization(output.id);

  if (!data) {
    return <LoadingOverlay visible />;
  }

  return <Visualization visualization={data as VisualizationsType} />;
};

export const OutputVisualization = ({ output }: { output: PluginOutput }) =>
  output.type === "ocel" ? (
    <OcelOutputVisualization output={output} />
  ) : (
    <ResourceOutputVisualization output={output} />
  );
