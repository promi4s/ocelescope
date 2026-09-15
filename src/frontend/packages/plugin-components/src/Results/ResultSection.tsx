import {
  Box,
  Center,
  Group,
  LoadingOverlay,
  Splitter,
  Stack,
  Text,
} from "@mantine/core";
import { usePluginResult } from "@ocelescope/api-base";
import { Visualization, type VisualizationsType } from "@ocelescope/resources";
import { useState } from "react";
import { DownloadAction } from "./Actions/DownloadAction";
import { SaveAction } from "./Actions/SaveAction";
import { OrientationAction } from "./Actions/OrientationAcion";
import { useToggle } from "@mantine/hooks";
import { SelectionAction } from "./Actions/SelectionAction";

const ResultSection: React.FC<{
  taskId?: string;
  extraActions?: React.ReactNode;
  noTaskIdInfo?: React.ReactNode;
}> = ({
  taskId,
  extraActions,
  noTaskIdInfo = "No Plugin run to schow Results",
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

  const [selected, setSelected] = useState<number[]>([0]);

  const [isHorizontal, toogleOrientation] = useToggle();

  return (
    <Stack gap={0} h="100%">
      <Group
        px="sm"
        py="xs"
        wrap="nowrap"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <SelectionAction
          output={pluginSummary ?? []}
          selectedOutputs={selected}
          setSelectedOutputs={setSelected}
        />
        <Group gap="xs" ml="auto" wrap="nowrap">
          {selected.length > 1 && (
            <OrientationAction
              isHorizontal={isHorizontal}
              toggleOrientation={toogleOrientation}
            />
          )}
          <DownloadAction taskId={taskId} selected={selected} />
          <SaveAction
            key={`${taskId}_${selected.join(",")}`}
            taskId={taskId}
            selected={selected}
            summary={pluginSummary ?? []}
          />
          {extraActions}
        </Group>
      </Group>

      <Box flex={1} mih={0} pos={"relative"}>
        <LoadingOverlay visible={!!taskId && !pluginSummary} />
        {!taskId ? (
          noTaskIdInfo
        ) : selected.length === 0 ? (
          <Center h="100%">
            <Text c="dimmed">Select one or more results to display.</Text>
          </Center>
        ) : (
          <Splitter
            key={`${isHorizontal}:${selected.join(",")}`}
            orientation={isHorizontal ? "horizontal" : "vertical"}
            lineSize={4}
            handleColor="var(--mantine-color-default-border)"
            h="100%"
          >
            {pluginSummary
              ?.filter(({ result_index }) => selected.includes(result_index))
              .map((output) => (
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
        )}
      </Box>
    </Stack>
  );
};

export default ResultSection;
