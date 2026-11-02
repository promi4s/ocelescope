import { Center, LoadingOverlay, Text } from "@mantine/core";
import {
  ResourceViewer,
  Visualization,
  type VisualizationsType,
} from "@ocelescope/resources";
import { type PluginOutput, useOcelVisualization } from "../../api/plugin";

const OcelOutputVisualization = ({ output }: { output: PluginOutput }) => {
  const { data, isError } = useOcelVisualization(output.id);

  if (isError) {
    return (
      <Center h="100%" p="md">
        <Text c="dimmed">Could not load the visualization</Text>
      </Center>
    );
  }

  if (!data) {
    return <LoadingOverlay visible />;
  }

  return <Visualization visualization={data as VisualizationsType} />;
};

export const OutputVisualization = ({ output }: { output: PluginOutput }) =>
  output.type === "ocel" ? (
    <OcelOutputVisualization output={output} />
  ) : (
    <ResourceViewer id={output.id} />
  );
