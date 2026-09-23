import { Button } from "@mantine/core";
import { DownloadIcon } from "lucide-react";
import { useDownloadOutputs } from "../../../hooks/useDownloadOutputs";

export const DownloadAction = ({
  taskId,
  outputIndices = [],
  disabled,
}: {
  taskId: string;
  outputIndices?: number[];
  disabled?: boolean;
}) => {
  const { handleDownload, isDownloading } = useDownloadOutputs({ taskId });
  return (
    <Button
      variant="default"
      leftSection={<DownloadIcon size={16} />}
      onClick={() => handleDownload(outputIndices)}
      loading={isDownloading}
      {...{ autoComplete: "off" }}
      disabled={disabled || outputIndices.length === 0}
    >
      Download
    </Button>
  );
};
