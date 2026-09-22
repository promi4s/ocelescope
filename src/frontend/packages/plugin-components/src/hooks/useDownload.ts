import { useDownloadPluginResults } from "@ocelescope/api-base";
import { useCallback } from "react";

type UseDownloadProps = {
  taskId: string;
};

export const useDownload = ({ taskId }: UseDownloadProps) => {
  const { mutate: downloadResults, isPending: isDownloading } =
    useDownloadPluginResults({
      request: { responseType: "blob" },
    });

  const handleDownload = useCallback(
    (selected: number[]) => {
      downloadResults(
        { taskId: taskId ?? "", data: { indices: selected } },
        {
          onSuccess: (data) => {
            const url = URL.createObjectURL(data as Blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "results.zip";
            anchor.click();
            URL.revokeObjectURL(url);
          },
        },
      );
    },
    [taskId],
  );

  return { isDownloading, handleDownload };
};
