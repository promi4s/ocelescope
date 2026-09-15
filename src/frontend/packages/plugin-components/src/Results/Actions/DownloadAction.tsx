import { Button } from "@mantine/core";
import { useDownloadPluginResults } from "@ocelescope/api-base";
import { DownloadIcon } from "lucide-react";
import { useCallback } from "react";

export const DownloadAction = ({
  taskId,
  selected = [],
}: {
  taskId?: string;
  selected?: number[];
}) => {
  const { mutate: downloadResults, isPending: isDownloading } =
    useDownloadPluginResults({
      request: { responseType: "blob" },
    });

  const handleDownload = useCallback(() => {
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
  }, [taskId, selected]);

  return (
    taskId &&
    selected.length > 0 && (
      <Button
        variant="default"
        leftSection={<DownloadIcon size={16} />}
        onClick={handleDownload}
        loading={isDownloading}
        disabled={selected.length === 0}
      >
        Download
      </Button>
    )
  );
};
