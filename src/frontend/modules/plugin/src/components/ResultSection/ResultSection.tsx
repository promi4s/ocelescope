import {
  useDownloadPluginResults,
  usePluginResult,
  useSavePluginResults,
  type OCELOutput,
  type ResourceOutput,
} from "@ocelescope/api-base";
import { Visualization, type VisualizationsType } from "@ocelescope/resources";
import { BarsList } from "@mantine/charts";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  MultiSelect,
  Splitter,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import {
  Columns2Icon,
  DatabaseIcon,
  DownloadIcon,
  Rows2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";

type PluginOutput = OCELOutput | ResourceOutput;

const ResourceCard: React.FC<{
  resource: ResourceOutput;
}> = ({ resource }) => {
  return (
    <Visualization
      visualization={resource.visualization as VisualizationsType}
    />
  );
};

export const OCELCard: React.FC<{ ocel: OCELOutput }> = ({ ocel }) => {
  return (
    <BarsList
      data={Object.entries(ocel.activity_count).map(([name, value]) => ({
        name,
        value,
      }))}
    />
  );
};

const entityTypeOf = (output: PluginOutput) =>
  output.type === "ocel" ? "ocel" : output.resource_type || "resource";

const ResultLabel: React.FC<{
  label: string;
  entityType: string;
  bold?: boolean;
}> = ({ label, entityType, bold }) => (
  <Group gap="xs" wrap="nowrap">
    <Text fw={bold ? 600 : undefined} truncate>
      {label}
    </Text>
    <Badge size="sm" color={generateColor(entityType)}>
      {entityType}
    </Badge>
  </Group>
);

const ResultPane: React.FC<{ output: PluginOutput }> = ({ output }) => (
  <Box h="100%" p="xs" pos="relative">
    {output.type === "ocel" ? (
      <OCELCard ocel={output} />
    ) : (
      <ResourceCard resource={output} />
    )}
  </Box>
);

const ResultSection: React.FC<{
  pluginId: string;
  methodName: string;
  taskId: string;
}> = ({ pluginId, methodName, taskId }) => {
  const { data: pluginSummary } = usePluginResult(
    pluginId,
    methodName,
    taskId,
    {
      query: {
        refetchInterval: ({ state }) => {
          if (state.data == null) {
            return 1000;
          }
          return false;
        },
      },
    },
  );

  const [selected, setSelected] = useState<string[] | null>(null);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(
    "vertical",
  );

  const { mutate: saveResults, isPending: isSaving } = useSavePluginResults();
  const { mutate: downloadResults, isPending: isDownloading } =
    useDownloadPluginResults({
      request: { responseType: "blob" },
    });

  const options = useMemo(
    () =>
      (pluginSummary ?? []).map((output, index) => {
        const entityType = entityTypeOf(output);
        return {
          value: String(index),
          label: `${entityType} ${index + 1}`,
          entityType,
        };
      }),
    [pluginSummary],
  );

  if (!pluginSummary) {
    return (
      <Center h="100%">
        <Stack align="center" gap="sm">
          <Loader />
          <Text c="dimmed">Running…</Text>
        </Stack>
      </Center>
    );
  }

  if (pluginSummary.length === 0) {
    return (
      <Center h="100%">
        <Text c="dimmed">This run produced no results.</Text>
      </Center>
    );
  }

  const selectedValues = selected ?? (options[0] ? [options[0].value] : []);
  const selectedOutputs = selectedValues
    .map((value) => Number(value))
    .map((index) => ({ index, output: pluginSummary[index] }))
    .filter(
      (entry): entry is { index: number; output: PluginOutput } =>
        entry.output != null,
    );

  const hasMultipleResults = options.length > 1;
  const shownIndices = selectedOutputs.map((entry) => entry.index);

  const handleDownload = () => {
    downloadResults(
      { pluginId, methodName, taskId, data: { indices: shownIndices } },
      {
        onSuccess: (data) => {
          const url = URL.createObjectURL(data as Blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${methodName}_results.zip`;
          anchor.click();
          URL.revokeObjectURL(url);
        },
      },
    );
  };

  const handleSaveToSession = () => {
    saveResults({
      pluginId,
      methodName,
      taskId,
      data: { indices: shownIndices },
    });
  };

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
        {hasMultipleResults ? (
          <MultiSelect
            flex={1}
            data={options}
            value={selectedValues}
            onChange={setSelected}
            placeholder="Select results to display"
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
            renderOption={({ option }) => {
              const output = pluginSummary[Number(option.value)];
              return (
                <ResultLabel
                  label={option.label}
                  entityType={output ? entityTypeOf(output) : option.label}
                />
              );
            }}
          />
        ) : (
          options[0] && (
            <ResultLabel
              label={options[0].label}
              entityType={options[0].entityType}
              bold
            />
          )
        )}
        <Group gap="xs" ml="auto" wrap="nowrap">
          {selectedOutputs.length > 1 && (
            <Tooltip
              label={
                orientation === "vertical"
                  ? "Show side by side"
                  : "Stack vertically"
              }
            >
              <ActionIcon
                variant="default"
                size="lg"
                onClick={() =>
                  setOrientation((prev) =>
                    prev === "vertical" ? "horizontal" : "vertical",
                  )
                }
              >
                {orientation === "vertical" ? (
                  <Columns2Icon size={16} />
                ) : (
                  <Rows2Icon size={16} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
          <Button
            variant="default"
            leftSection={<DownloadIcon size={16} />}
            onClick={handleDownload}
            loading={isDownloading}
            disabled={shownIndices.length === 0}
          >
            Download
          </Button>
          <Button
            variant="light"
            leftSection={<DatabaseIcon size={16} />}
            onClick={handleSaveToSession}
            loading={isSaving}
            disabled={shownIndices.length === 0}
          >
            Save to session
          </Button>
        </Group>
      </Group>

      {selectedOutputs.length === 0 ? (
        <Center style={{ flex: 1 }}>
          <Text c="dimmed">Select one or more results to display.</Text>
        </Center>
      ) : (
        <Splitter
          key={`${orientation}:${selectedValues.join(",")}`}
          orientation={orientation}
          lineSize={4}
          handleColor="var(--mantine-color-default-border)"
          style={{ flex: 1, minHeight: 0 }}
        >
          {selectedOutputs.map(({ index, output }) => (
            <Splitter.Pane
              key={index}
              defaultSize={100 / selectedOutputs.length}
              min="15%"
            >
              <ResultPane output={output} />
            </Splitter.Pane>
          ))}
        </Splitter>
      )}
    </Stack>
  );
};

export default ResultSection;
