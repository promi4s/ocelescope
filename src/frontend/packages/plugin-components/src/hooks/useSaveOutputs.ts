import { useCallback, useMemo, useState } from "react";
import { type ResultSelection, useSavePluginResults } from "../api/plugin";

export const useSaveOutputs = ({ taskId }: { taskId: string }) => {
  const { mutate: saveOutputs, isPending: isSaving } = useSavePluginResults();

  const [saved, setSaved] = useState<{ taskId: string; ids: string[] }>({
    taskId,
    ids: [],
  });

  const savedIds = useMemo(
    () => (saved.taskId === taskId ? saved.ids : []),
    [saved, taskId],
  );

  const handleSave = useCallback(
    (selections: ResultSelection[]) =>
      saveOutputs(
        { taskId, data: selections },
        {
          onSuccess: () =>
            setSaved((prev) => {
              const ids = prev.taskId === taskId ? prev.ids : [];
              return {
                taskId,
                ids: [...new Set([...ids, ...selections.map(({ id }) => id)])],
              };
            }),
        },
      ),
    [saveOutputs, taskId],
  );

  const isSaved = useCallback(
    (ids: string[]) =>
      ids.length > 0 && ids.every((id) => savedIds.includes(id)),
    [savedIds],
  );

  return { handleSave, savedIds, isSaved, isSaving };
};
