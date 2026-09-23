import {
  type ResultSelection,
  useSavePluginResults,
} from "@ocelescope/api-base";
import { useCallback, useMemo, useState } from "react";

export const useSaveOutputs = ({ taskId }: { taskId: string }) => {
  const { mutate: saveOutputs, isPending: isSaving } = useSavePluginResults();

  const [saved, setSaved] = useState<{ taskId: string; indices: number[] }>({
    taskId,
    indices: [],
  });

  const savedIndices = useMemo(
    () => (saved.taskId === taskId ? saved.indices : []),
    [saved, taskId],
  );

  const handleSave = useCallback(
    (selections: ResultSelection[]) =>
      saveOutputs(
        { taskId, data: selections },
        {
          onSuccess: () =>
            setSaved((prev) => {
              const indices = prev.taskId === taskId ? prev.indices : [];
              return {
                taskId,
                indices: [
                  ...new Set([
                    ...indices,
                    ...selections.map(({ index }) => index),
                  ]),
                ],
              };
            }),
        },
      ),
    [saveOutputs, taskId],
  );

  const isSaved = useCallback(
    (indices: number[]) =>
      indices.length > 0 &&
      indices.every((index) => savedIndices.includes(index)),
    [savedIndices],
  );

  return { handleSave, savedIndices, isSaved, isSaving };
};
