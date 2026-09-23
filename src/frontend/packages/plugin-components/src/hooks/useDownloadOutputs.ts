import { useDownloadPluginResults } from "@ocelescope/api-base";
import { useCallback } from "react";

export const useDownloadOutputs = ({ taskId }: { taskId: string }) => {
  const { mutate: downloadOutputs, isPending: isDownloading } =
    useDownloadPluginResults({
      request: { responseType: "blob" },
    });

  const handleDownload = useCallback(
    (indices: number[]) => {
      downloadOutputs(
        { taskId, data: { indices } },
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
