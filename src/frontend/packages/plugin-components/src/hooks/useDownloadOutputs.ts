import { useCallback } from "react";
import { useDownloadPluginResults } from "../api/plugin";

export const useDownloadOutputs = ({ taskId }: { taskId: string }) => {
  const { mutate: downloadOutputs, isPending: isDownloading } =
    useDownloadPluginResults({
      request: { responseType: "blob" },
    });

  const handleDownload = useCallback(
    (ids: string[]) => {
      downloadOutputs(
        { taskId, data: { ids } },
        {
          onSuccess: (data) => {
            const url = URL.createObjectURL(data as Blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "outputs.zip";
            anchor.click();
            URL.revokeObjectURL(url);
          },
        },
      );
    },
    [downloadOutputs, taskId],
  );

  return { handleDownload, isDownloading };
};
