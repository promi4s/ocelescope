import { Button } from "@mantine/core";
import { CheckIcon, DatabaseIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { SaveModal } from "../SaveModal";
import type { PluginOutput } from "@ocelescope/api-base";
import useSaveToSession from "../../hooks/useSaveToSession";

export const SaveAction = ({
  disabled,
  selected,
  taskId,
}: {
  disabled?: boolean;
  taskId: string;
  selected: PluginOutput[];
}) => {
  const { isSaved, isSaving, handleSaveToSession } = useSaveToSession({
    taskId,
  });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const isCurrentSelectionSaved = useMemo(
    () => isSaved(selected.map(({ result_index }) => result_index)),
    [selected, isSaved],
  );

  return (
    <>
      <Button
        variant="light"
        color={isCurrentSelectionSaved ? "green" : undefined}
        leftSection={
          isCurrentSelectionSaved ? (
            <CheckIcon size={16} />
          ) : (
            <DatabaseIcon size={16} />
          )
        }
        onClick={() => setIsSaveModalOpen(true)}
        loading={isSaving}
        {...{ autoComplete: "off" }}
        disabled={disabled || selected.length === 0}
      >
        {isCurrentSelectionSaved ? "Saved" : "Save to session"}
      </Button>
      <SaveModal
        opened={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        results={selected}
        onSave={handleSaveToSession}
      />
    </>
  );
};
