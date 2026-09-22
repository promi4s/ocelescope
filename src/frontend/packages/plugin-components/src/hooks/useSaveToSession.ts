import {
  useSavePluginResults,
  type ResultSelection,
} from "@ocelescope/api-base";
import { useCallback, useMemo, useState } from "react";

type useSaveToSessionProps = {
  taskId: string;
};

const useSaveToSession = ({ taskId }: useSaveToSessionProps) => {
  const { mutate: saveResults, isPending: isSaving } = useSavePluginResults();

  const [saved, setSaved] = useState<{ taskId: string; indices: number[] }>({
    taskId,
    indices: [],
  });

  const savedIndices = useMemo(
    () => (saved.taskId === taskId ? saved.indices : []),
    [saved, taskId],
  );

  const handleSaveToSession = useCallback(
    (results: ResultSelection[]) =>
      saveResults(
        {
          taskId: taskId ?? "",
          data: results,
        },
        {
          onSuccess: () =>
            setSaved((prev) => {
              const indices = prev.taskId === taskId ? prev.indices : [];
              return {
                taskId,
                indices: [
                  ...new Set([
                    ...indices,
                    ...results.map(({ index }) => index),
                  ]),
                ],
              };
            }),
        },
      ),
    [saveResults, taskId],
  );

  const isSaved = (resultIndex: number[]) =>
    resultIndex.length > 0 &&
    resultIndex.every((index) => savedIndices.includes(index));

  return { handleSaveToSession, savedIndices, isSaved, isSaving };
};

export default useSaveToSession;
