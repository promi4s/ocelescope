import {
  Box,
  Center,
  Flex,
  Group,
  LoadingOverlay,
  ScrollArea,
  Splitter,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { SplitterPaneSize } from "@mantine/hooks";
import { useGetPluginMethod } from "@ocelescope/api-base";
import { useState } from "react";
import PluginInput from "../components/Form";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";
import ResultSection from "../components/ResultSection/ResultSection";

const COLLAPSED_SIZES: SplitterPaneSize[] = [0, 100];
const SPLIT_SIZES: SplitterPaneSize[] = [75, 25];

const MethodPage: React.FC<{ pluginId: string; methodName: string }> = ({
  pluginId,
  methodName,
}) => {
  const { data: pluginMethod } = useGetPluginMethod(pluginId, methodName);

  const [currentTask, setCurrentTask] = useState<string>();
  const [sizes, setSizes] = useState<SplitterPaneSize[]>(COLLAPSED_SIZES);

  if (!pluginMethod) {
    return <LoadingOverlay visible={true} />;
  }

  const handleSuccess = (taskId: string) => {
    setCurrentTask(taskId);
    setSizes((prev) => (prev[0] === 0 ? SPLIT_SIZES : prev));
  };

  return (
    <Flex direction="column" h="100%">
      <Splitter
        sizes={sizes}
        onSizeChange={setSizes}
        lineSize={4}
        handleColor="var(--mantine-color-default-border)"
        px="xs"
        style={{ flex: 1, minHeight: 0 }}
      >
        <Splitter.Pane defaultSize={0} min="20%" collapsible>
          <Box h="100%" pos="relative" style={{ overflow: "hidden" }}>
            {currentTask ? (
              <ResultSection
                key={currentTask}
                pluginId={pluginId}
                methodName={methodName}
                taskId={currentTask}
              />
            ) : (
              <Center h="100%" p="md">
                <Text c="dimmed" ta="center">
                  Run the method to see its results here.
                </Text>
              </Center>
            )}
          </Box>
        </Splitter.Pane>

        <Splitter.Pane defaultSize={100} min="20%" collapsible>
          <ScrollArea h="100%" type="auto">
            <Stack gap="sm" p="md" maw={640} mx="auto" w="100%">
              <Group justify="center">
                <PluginBreadcrumbs />
              </Group>
              <Title ta="center">{pluginMethod.label ?? methodName}</Title>
              {pluginMethod.description && (
                <Text c="dimmed" ta="center">
                  {pluginMethod.description}
                </Text>
              )}
              <PluginInput
                onSuccess={handleSuccess}
                pluginId={pluginId}
                method={pluginMethod}
              />
            </Stack>
          </ScrollArea>
        </Splitter.Pane>
      </Splitter>
    </Flex>
  );
};

export default MethodPage;
