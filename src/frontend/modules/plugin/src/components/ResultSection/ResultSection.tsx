import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Splitter,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import {
  type PluginOutput,
  type ResultSelection,
  useDownloadPluginResults,
  usePluginResult,
  useSavePluginResults,
} from "@ocelescope/api-base";
import { Visualization, type VisualizationsType } from "@ocelescope/resources";
import {
  CheckIcon,
  Columns2Icon,
  DatabaseIcon,
  DownloadIcon,
  Rows2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";

const ResultLabel: React.FC<{
  label: string;
  entityType: string;
  bold?: boolean;
}> = ({ label, entityType, bold }) => (
  <Group gap="xs" wrap="nowrap">
    <Text fw={bold ? 600 : undefined} truncate maw={120}>
      {label}
    </Text>
    <Badge
      size="sm"
      color={generateColor(entityType)}
      style={{ flexShrink: 0 }}
    >
      {entityType}
    </Badge>
  </Group>
);

const SaveModal = ({
  opened,
  onClose,
  results,
  onSave,
}: {
  opened: boolean;
  onClose: () => void;
  onSave: (results: ResultSelection[]) => void;
  results: PluginOutput[];
}) => {
  const [names, setNames] = useState<Record<number, string>>({});

  return (
    <Modal opened={opened} onClose={onClose} title={"Save to Session"}>
      <Stack>
        <Stack gap={"xs"}>
          {results.map(({ default_name, result_index, type_label }) => (
            <Group key={result_index}>
              <TextInput
                placeholder={default_name}
                value={names[result_index] ?? ""}
                flex={1}
                onChange={(newValue) =>
                  setNames({
                    ...names,
                    [result_index]: newValue.currentTarget.value,
                  })
                }
              />
              <Badge size="sm" color={generateColor(type_label)}>
                {type_label}
              </Badge>
            </Group>
          ))}
        </Stack>
        <Button
          onClick={() => {
            onSave(
              results.map(({ result_index }) => ({
                index: result_index,
                name: names[result_index] ?? null,
              })),
            );
            onClose();
          }}
        >
          Save to Session
        </Button>
      </Stack>
    </Modal>
  );
};

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

  const [selected, setSelected] = useState<number[]>([0]);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(
    "vertical",
  );

  const {
    mutate: saveResults,
    isPending: isSaving,
    isSuccess: isSaved,
    reset: resetSave,
  } = useSavePluginResults();

  const { mutate: downloadResults, isPending: isDownloading } =
    useDownloadPluginResults({
      request: { responseType: "blob" },
    });

  const options = useMemo(
    () =>
      (pluginSummary ?? []).map((output) => {
        return {
          value: output.result_index,
          label: output.default_name,
          entityType: output.type_label,
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

  const handleSelectionChange = (value: number[]) => {
    setSelected(value);
    resetSave();
  };

  const handleDownload = () => {
    downloadResults(
      { pluginId, methodName, taskId, data: { indices: selected } },
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

  const handleSaveToSession = (results: ResultSelection[]) => {
    saveResults({
      pluginId,
      methodName,
      taskId,
      data: results,
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
        {options.length > 1 ? (
          <MultiSelect
            flex={1}
            data={options}
            onChange={handleSelectionChange}
            value={selected}
            placeholder="Select results to display"
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
            renderOption={({ option, checked }) => {
              const output = pluginSummary[Number(option.value)];
              return (
                <Group align="center">
                  {checked && <CheckIcon size={16} color="grey" />}
                  <ResultLabel
                    label={option.label}
                    entityType={output?.type_label ?? ""}
                  />
                </Group>
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
          {selected.length > 1 && (
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
            disabled={selected.length === 0}
          >
            Download
          </Button>
          <Button
            variant="light"
            color={isSaved ? "green" : undefined}
            leftSection={
              isSaved ? <CheckIcon size={16} /> : <DatabaseIcon size={16} />
            }
            onClick={() => setIsSaveModalOpen(true)}
            loading={isSaving}
            disabled={selected.length === 0}
          >
            {isSaved ? "Saved" : "Save to session"}
          </Button>
        </Group>
      </Group>

      <SaveModal
        opened={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        results={pluginSummary.filter(({ result_index }) =>
          selected.includes(result_index),
        )}
        onSave={handleSaveToSession}
      />

      {selected.length === 0 ? (
        <Center style={{ flex: 1 }}>
          <Text c="dimmed">Select one or more results to display.</Text>
        </Center>
      ) : (
        <Splitter
          key={`${orientation}:${selected.join(",")}`}
          orientation={orientation}
          lineSize={4}
          handleColor="var(--mantine-color-default-border)"
          style={{ flex: 1, minHeight: 0 }}
        >
          {pluginSummary
            ?.filter(({ result_index }) => selected.includes(result_index))
            .map((output) => (
              <Splitter.Pane
                key={output.result_index}
                defaultSize={100 / selected.length}
                min="15%"
              >
                <Box h="100%" p="xs" pos="relative">
                  <Visualization
                    visualization={output.visualization as VisualizationsType}
                  />
                </Box>
              </Splitter.Pane>
            ))}
        </Splitter>
      )}
    </Stack>
  );
};

export default ResultSection;
