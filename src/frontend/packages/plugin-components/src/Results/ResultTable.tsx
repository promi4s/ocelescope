import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Table,
  Tooltip,
} from "@mantine/core";
import { type PluginOutput } from "@ocelescope/api-base";
import { useCallback, useState } from "react";

import { generateColor } from "@marko19907/string-to-color";
import { DatabaseIcon, DownloadIcon, EyeIcon } from "lucide-react";
import { SaveModal } from "./SaveModal";
import useSaveToSession from "../hooks/useSaveToSession";
import { useDownload } from "../hooks/useDownload";

const ResultListActionIcons = ({
  onDownload,
  onSave,
  onView,
  value,
}: {
  value: number[];
  onView: (result_indicies: number[]) => void;
  onDownload: (result_indicies: number[]) => void;
  onSave: (result_indicies: number[]) => void;
}) => (
  <ActionIcon.Group onClick={(event) => event.stopPropagation()}>
    <Tooltip label="Show visualization">
      <ActionIcon variant="subtle" onClick={() => onView(value)} bdrs={0}>
        <EyeIcon size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="Save to session">
      <ActionIcon variant="subtle" onClick={() => onSave(value)}>
        <DatabaseIcon size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="Download">
      <ActionIcon variant="subtle" onClick={() => onDownload(value)} bdrs={0}>
        <DownloadIcon size={16} />
      </ActionIcon>
    </Tooltip>
  </ActionIcon.Group>
);

export const ResultList = ({
  outputs,
  onView,
  taskId,
}: {
  outputs: PluginOutput[];
  onView: (result_indicies: number[]) => void;
  taskId: string;
}) => {
  const [selectedOutputs, setSelectedOutputs] = useState<number[]>([]);

  const { handleDownload } = useDownload({ taskId });

  const toogleOutput = useCallback(
    (index: number) =>
      !selectedOutputs.includes(index)
        ? setSelectedOutputs([...selectedOutputs, index])
        : setSelectedOutputs(
            selectedOutputs.filter((value) => value !== index),
          ),
    [selectedOutputs, setSelectedOutputs],
  );

  const { handleSaveToSession } = useSaveToSession({ taskId });

  const [savingIndicies, setSavingIndicies] = useState<number[] | null>(null);

  return (
    <Box
      h="100%"
      w="100%"
      style={{
        overflow: "auto",
        border: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <SaveModal
        results={outputs.filter(({ result_index }) =>
          savingIndicies?.includes(result_index),
        )}
        onSave={handleSaveToSession}
        opened={!!savingIndicies}
        onClose={() => setSavingIndicies(null)}
      />
      <Table stickyHeader highlightOnHover>
        <Table.Thead h={42}>
          <Table.Tr>
            <Table.Th w={0}>
              <Checkbox
                checked={selectedOutputs.length === outputs.length}
                onChange={(event) =>
                  event.currentTarget.checked
                    ? setSelectedOutputs(
                        outputs.map(({ result_index }) => result_index),
                      )
                    : setSelectedOutputs([])
                }
              />
            </Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th w={0}>
              {selectedOutputs.length > 0 && (
                <ResultListActionIcons
                  value={selectedOutputs}
                  onSave={setSavingIndicies}
                  onView={onView}
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
              onClick={() => toogleOutput(result_index)}
            >
              <Table.Td>
                <Checkbox
                  checked={selectedOutputs.includes(result_index)}
                  onChange={() => {
                    toogleOutput(result_index);
                  }}
                />
              </Table.Td>
              <Table.Td>{default_name}</Table.Td>
              <Table.Td>
                <Badge color={generateColor(type_label)}>{type_label}</Badge>
              </Table.Td>
              <Table.Td>
                <ResultListActionIcons
                  value={[result_index]}
                  onSave={setSavingIndicies}
                  onView={onView}
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
