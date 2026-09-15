import { Badge, Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import {
  useSavePluginResults,
  type PluginOutput,
  type ResultSelection,
} from "@ocelescope/api-base";
import { CheckIcon, DatabaseIcon } from "lucide-react";
import { useState } from "react";

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

export const SaveAction = ({
  taskId,
  selected = [],
  summary,
  disabled,
}: {
  taskId?: string;
  selected?: number[];
  summary: PluginOutput[];
  disabled?: boolean;
}) => {
  const {
    mutate: saveResults,
    isPending: isSaving,
    isSuccess: isSaved,
  } = useSavePluginResults();

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const handleSaveToSession = (results: ResultSelection[]) => {
    saveResults({
      taskId: taskId ?? "",
      data: results,
    });
  };

  return (
    <>
      <Button
        variant="light"
        color={isSaved ? "green" : undefined}
        leftSection={
          isSaved ? <CheckIcon size={16} /> : <DatabaseIcon size={16} />
        }
        onClick={() => setIsSaveModalOpen(true)}
        loading={isSaving}
        disabled={disabled || selected.length === 0}
      >
        {isSaved ? "Saved" : "Save to session"}
      </Button>
      <SaveModal
        opened={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        results={summary.filter(({ result_index }) =>
          selected.includes(result_index),
        )}
        onSave={handleSaveToSession}
      />
    </>
  );
};
