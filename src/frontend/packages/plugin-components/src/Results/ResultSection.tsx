import {
  Box,
  Center,
  Group,
  Loader,
  LoadingOverlay,
  Splitter,
  Stack,
  Text,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { usePluginResult } from "@ocelescope/api-base";
import { Visualization, type VisualizationsType } from "@ocelescope/resources";
import { useEffect, useMemo, useState } from "react";
import { DownloadAction } from "./Actions/DownloadAction";
import { OrientationAction } from "./Actions/OrientationAction";
import { SaveAction } from "./Actions/SaveAction";
import { SelectionAction } from "./Actions/SelectionAction";

const ResultSection: React.FC<{
  taskId?: string;
  extraActions?: React.ReactNode;
  noTaskIdInfo?: string;
}> = ({
  taskId,
  extraActions,
  noTaskIdInfo = "No Plugin was run to show a result",
}) => {
  const { data: pluginSummary } = usePluginResult(taskId ?? "", {
    query: {
      refetchInterval: ({ state }) => {
        if (state.data == null) {
          return 1000;
        }
        return false;
      },
      enabled: !!taskId,
    },
  });

  const [selected, setSelected] = useState<number[]>([]);

  const [isHorizontal, toggleOrientation] = useToggle();

  const isLoading = !!taskId && !pluginSummary;

  useEffect(() => {
    if (pluginSummary && pluginSummary.length > 0 && selected.length === 0) {
      setSelected([0]);
    } else {
      const cleanedSelections = selected.filter(
        (index) => index < (pluginSummary ?? []).length,
      );
      if (cleanedSelections.length < selected.length) {
        setSelected(cleanedSelections);
      }
    }
  }, [pluginSummary, selected]);

  const selectedResources = useMemo(
    () =>
      (pluginSummary ?? []).filter(({ result_index }) =>
        selected.includes(result_index),
      ),
    [taskId, selected, pluginSummary],
  );

  return (
    <Stack gap={0} h="100%">
      <Group
        px="sm"
        py="xs"
        wrap="nowrap"
        gap={"xl"}
        style={{
          borderBottom: "2px solid var(--mantine-color-default-border)",
        }}
      >
        <SelectionAction
          output={pluginSummary ?? []}
          selectedOutputs={selected}
          isLoading={isLoading}
          setSelectedOutputs={setSelected}
        />
        <Group gap="xs" ml="auto" wrap="nowrap">
          {selected.length > 1 && (
            <OrientationAction
              isHorizontal={isHorizontal}
              toggleOrientation={toggleOrientation}
            />
          )}
          <DownloadAction
            taskId={taskId}
            selected={selected}
            disabled={isLoading}
          />
          <SaveAction
            key={`${taskId}_${selected.join(",")}`}
            taskId={taskId}
            selected={selected}
            disabled={isLoading}
            summary={pluginSummary ?? []}
          />
          {extraActions}
        </Group>
      </Group>

      <Box flex={1} mih={0} pos={"relative"}>
        <LoadingOverlay visible={isLoading} zIndex={1} />
        {selectedResources.length > 0 ? (
          <Splitter
            key={`${isHorizontal}:${selected.join(",")}`}
            orientation={isHorizontal ? "horizontal" : "vertical"}
            lineSize={4}
            handleColor="var(--mantine-color-default-border)"
            h="100%"
          >
            {selectedResources.map((output) => (
              <Splitter.Pane
                key={output.result_index}
                defaultSize={100 / selected.length}
                min="15%"
              >
                <Box h="100%" pos="relative">
                  <Visualization
                    visualization={output.visualization as VisualizationsType}
                  />
                </Box>
              </Splitter.Pane>
            ))}
          </Splitter>
        ) : (
          <Center h={"100%"}>
            {isLoading ? (
              <Loader />
            ) : (
              <Text c="dimmed">
                {!taskId ? noTaskIdInfo : "Please select a result to show"}
              </Text>
            )}
          </Center>
        )}
      </Box>
    </Stack>
  );
};

export default ResultSection;
