import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Table,
  Tooltip,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import { DatabaseIcon, DownloadIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
import type { PluginOutput } from "../../api/plugin";
import { useDownloadOutputs } from "../../hooks/useDownloadOutputs";
import { useSaveOutputs } from "../../hooks/useSaveOutputs";
import { SaveOutputsModal } from "./SaveOutputsModal";

const OutputRowActions = ({
  outputIds,
  onView,
  onSave,
  onDownload,
}: {
  outputIds: string[];
  onView: (outputIds: string[]) => void;
  onSave: (outputIds: string[]) => void;
  onDownload: (outputIds: string[]) => void;
}) => (
  <ActionIcon.Group onClick={(event) => event.stopPropagation()}>
    <Tooltip label="Show visualization">
      <ActionIcon variant="subtle" onClick={() => onView(outputIds)} bdrs={0}>
        <EyeIcon size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="Save to session">
      <ActionIcon variant="subtle" onClick={() => onSave(outputIds)}>
        <DatabaseIcon size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="Download">
      <ActionIcon
        variant="subtle"
        onClick={() => onDownload(outputIds)}
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
  onView: (outputIds: string[]) => void;
}) => {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [idsToSave, setIdsToSave] = useState<string[] | null>(null);

  const { handleDownload } = useDownloadOutputs({ taskId });
  const { handleSave } = useSaveOutputs({ taskId });

  const toggleOutput = (id: string) =>
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );

  const allChecked = outputs.length > 0 && checkedIds.length === outputs.length;

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
        key={idsToSave?.join(",")}
        outputs={outputs.filter(({ id }) => idsToSave?.includes(id))}
        onSave={handleSave}
        opened={!!idsToSave}
        onClose={() => setIdsToSave(null)}
      />
      <Table stickyHeader highlightOnHover>
        <Table.Thead h={42}>
          <Table.Tr>
            <Table.Th w={0}>
              <Checkbox
                checked={allChecked}
                indeterminate={checkedIds.length > 0 && !allChecked}
                onChange={(event) =>
                  setCheckedIds(
                    event.currentTarget.checked
                      ? outputs.map(({ id }) => id)
                      : [],
                  )
                }
              />
            </Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th w={0}>
              {checkedIds.length > 0 && (
                <OutputRowActions
                  outputIds={checkedIds}
                  onView={onView}
                  onSave={setIdsToSave}
                  onDownload={handleDownload}
                />
              )}
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {outputs.map(({ id, name, type_label }) => (
            <Table.Tr key={id} onClick={() => toggleOutput(id)}>
              <Table.Td>
                <Checkbox
                  checked={checkedIds.includes(id)}
                  onChange={() => toggleOutput(id)}
                  onClick={(event) => event.stopPropagation()}
                />
              </Table.Td>
              <Table.Td>{name}</Table.Td>
              <Table.Td>
                <Badge color={generateColor(type_label)}>{type_label}</Badge>
              </Table.Td>
              <Table.Td>
                <OutputRowActions
                  outputIds={[id]}
                  onView={onView}
                  onSave={setIdsToSave}
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
