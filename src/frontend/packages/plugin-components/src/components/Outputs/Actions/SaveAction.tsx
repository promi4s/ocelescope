import { Button } from "@mantine/core";
import { CheckIcon, DatabaseIcon } from "lucide-react";
import { useState } from "react";
import type { PluginOutput } from "../../../api/plugin";
import { useSaveOutputs } from "../../../hooks/useSaveOutputs";
import { SaveOutputsModal } from "../SaveOutputsModal";

export const SaveAction = ({
  taskId,
  outputs,
  disabled,
}: {
  taskId: string;
  outputs: PluginOutput[];
  disabled?: boolean;
}) => {
  const { handleSave, isSaved, isSaving } = useSaveOutputs({ taskId });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const areOutputsSaved = isSaved(outputs.map(({ id }) => id));

  return (
    <>
      <Button
        variant="light"
        color={areOutputsSaved ? "green" : undefined}
        leftSection={
          areOutputsSaved ? <CheckIcon size={16} /> : <DatabaseIcon size={16} />
        }
        onClick={() => setIsSaveModalOpen(true)}
        loading={isSaving}
        {...{ autoComplete: "off" }}
        disabled={disabled || outputs.length === 0}
      >
        {areOutputsSaved ? "Saved" : "Save to session"}
      </Button>
      <SaveOutputsModal
        key={isSaveModalOpen ? "open" : "closed"}
        opened={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        outputs={outputs}
        onSave={handleSave}
      />
    </>
  );
};
