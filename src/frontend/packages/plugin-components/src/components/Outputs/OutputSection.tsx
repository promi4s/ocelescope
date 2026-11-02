import {
  Box,
  Center,
  Group,
  LoadingOverlay,
  Splitter,
  Stack,
  Text,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { usePluginResult } from "../../api/plugin";
import { DownloadAction } from "./Actions/DownloadAction";
import { OrientationAction } from "./Actions/OrientationAction";
import { SaveAction } from "./Actions/SaveAction";
import { SelectionAction } from "./Actions/SelectionAction";
import { OutputList } from "./OutputList";
import { OutputVisualization } from "./OutputVisualization";

export type OutputSectionProps = {
  taskId?: string;
  extraActions?: React.ReactNode;
  noTaskIdInfo?: string;
  autoShowFirstOutput?: boolean;
};

const OutputSection: React.FC<OutputSectionProps> = ({
  taskId,
  extraActions,
  noTaskIdInfo = "Run a plugin method to see its outputs",
  autoShowFirstOutput = true,
}) => {
  const { data: outputs } = usePluginResult(taskId ?? "", {
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

  const [shownIds, setShownIds] = useState<string[]>([]);
  const [initializedTaskId, setInitializedTaskId] = useState<string>();

  if (outputs && taskId !== initializedTaskId) {
    setInitializedTaskId(taskId);
    setShownIds(autoShowFirstOutput && outputs[0] ? [outputs[0].id] : []);
  }

  const [isHorizontal, toggleOrientation] = useToggle();

  const isLoading = !!taskId && !outputs;

  const shownOutputs = useMemo(
    () => (outputs ?? []).filter(({ id }) => shownIds.includes(id)),
    [outputs, shownIds],
  );

  return (
    <Stack gap={0} h="100%">
      <Group
        px="sm"
        py="xs"
        wrap="nowrap"
        style={{
          borderBottom: "2px solid var(--mantine-color-default-border)",
        }}
        gap={"xs"}
        justify="end"
      >
        {taskId && shownOutputs.length > 0 && (
          <>
            <SelectionAction
              outputs={outputs ?? []}
              value={shownIds}
              onChange={setShownIds}
            />
            {shownOutputs.length > 1 && (
              <OrientationAction
                isHorizontal={isHorizontal}
                toggleOrientation={toggleOrientation}
              />
            )}
            <DownloadAction taskId={taskId} outputIds={shownIds} />
            <SaveAction taskId={taskId} outputs={shownOutputs} />
          </>
        )}
        {extraActions}
      </Group>

      <Box flex={1} mih={0} pos={"relative"}>
        <LoadingOverlay visible={isLoading} zIndex={1} />
        {taskId &&
          outputs &&
          (shownOutputs.length > 0 ? (
            <Splitter
              key={`${isHorizontal}:${shownIds.join(",")}`}
              orientation={isHorizontal ? "horizontal" : "vertical"}
              lineSize={4}
              handleColor="var(--mantine-color-default-border)"
              h="100%"
            >
              {shownOutputs.map((output) => (
                <Splitter.Pane
                  key={output.id}
                  defaultSize={100 / shownOutputs.length}
                  min="15%"
                >
                  <Box h="100%" pos="relative">
                    <OutputVisualization output={output} />
                  </Box>
                </Splitter.Pane>
              ))}
            </Splitter>
          ) : (
            <OutputList
              key={taskId}
              taskId={taskId}
              outputs={outputs}
              onView={setShownIds}
            />
          ))}
        {!taskId && (
          <Center h="100%">
            <Text c="dimmed">{noTaskIdInfo}</Text>
          </Center>
        )}
      </Box>
    </Stack>
  );
};

export default OutputSection;
