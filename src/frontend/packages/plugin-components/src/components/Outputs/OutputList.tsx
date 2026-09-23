import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Table,
  Tooltip,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import type { PluginOutput } from "@ocelescope/api-base";
import { DatabaseIcon, DownloadIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
import { useDownloadOutputs } from "../../hooks/useDownloadOutputs";
import { useSaveOutputs } from "../../hooks/useSaveOutputs";
import { SaveOutputsModal } from "./SaveOutputsModal";

const OutputRowActions = ({
  outputIndices,
  onView,
  onSave,
  onDownload,
}: {
  outputIndices: number[];
  onView: (outputIndices: number[]) => void;
  onSave: (outputIndices: number[]) => void;
  onDownload: (outputIndices: number[]) => void;
}) => (
  <ActionIcon.Group onClick={(event) => event.stopPropagation()}>
    <Tooltip label="Show visualization">
      <ActionIcon
        variant="subtle"
        onClick={() => onView(outputIndices)}
        bdrs={0}
      >
        <EyeIcon size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="Save to session">
      <ActionIcon variant="subtle" onClick={() => onSave(outputIndices)}>
        <DatabaseIcon size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="Download">
      <ActionIcon
        variant="subtle"
        onClick={() => onDownload(outputIndices)}
        bdrs={0}
      >
        <DownloadIcon size={16} />
      </ActionIcon>
    </Tooltip>
  </ActionIcon.Group>
);

export const OutputList = ({
  taskId,
  outputs,
  onView,
}: {
  taskId: string;
  outputs: PluginOutput[];
  onView: (outputIndices: number[]) => void;
}) => {
  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);
  const [indicesToSave, setIndicesToSave] = useState<number[] | null>(null);

  const { handleDownload } = useDownloadOutputs({ taskId });
  const { handleSave } = useSaveOutputs({ taskId });

  const toggleOutput = (index: number) =>
    setCheckedIndices((prev) =>
      prev.includes(index)
        ? prev.filter((value) => value !== index)
        : [...prev, index],
    );

  const allChecked =
    outputs.length > 0 && checkedIndices.length === outputs.length;

  return (
    <Box
      h="100%"
      w="100%"
      style={{
        overflow: "auto",
        border: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <SaveOutputsModal
        key={indicesToSave?.join(",")}
        outputs={outputs.filter(({ result_index }) =>
          indicesToSave?.includes(result_index),
        )}
        onSave={handleSave}
        opened={!!indicesToSave}
        onClose={() => setIndicesToSave(null)}
      />
      <Table stickyHeader highlightOnHover>
        <Table.Thead h={42}>
          <Table.Tr>
            <Table.Th w={0}>
              <Checkbox
                checked={allChecked}
                indeterminate={checkedIndices.length > 0 && !allChecked}
                onChange={(event) =>
                  setCheckedIndices(
                    event.currentTarget.checked
                      ? outputs.map(({ result_index }) => result_index)
                      : [],
                  )
                }
              />
            </Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th w={0}>
              {checkedIndices.length > 0 && (
                <OutputRowActions
                  outputIndices={checkedIndices}
                  onView={onView}
                  onSave={setIndicesToSave}
                  onDownload={handleDownload}
                />
              )}
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {outputs.map(({ default_name, type_label, result_index }) => (
            <Table.Tr
              key={result_index}
              onClick={() => toggleOutput(result_index)}
            >
              <Table.Td>
                <Checkbox
                  checked={checkedIndices.includes(result_index)}
                  onChange={() => toggleOutput(result_index)}
                  onClick={(event) => event.stopPropagation()}
                />
              </Table.Td>
              <Table.Td>{default_name}</Table.Td>
              <Table.Td>
                <Badge color={generateColor(type_label)}>{type_label}</Badge>
              </Table.Td>
              <Table.Td>
                <OutputRowActions
                  outputIndices={[result_index]}
                  onView={onView}
                  onSave={setIndicesToSave}
                  onDownload={handleDownload}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
};
