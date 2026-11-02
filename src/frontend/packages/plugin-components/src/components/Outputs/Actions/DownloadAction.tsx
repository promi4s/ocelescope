import { Button } from "@mantine/core";
import { DownloadIcon } from "lucide-react";
import { useDownloadOutputs } from "../../../hooks/useDownloadOutputs";

export const DownloadAction = ({
  taskId,
  outputIds = [],
  disabled,
}: {
  taskId: string;
  outputIds?: string[];
  disabled?: boolean;
}) => {
  const { handleDownload, isDownloading } = useDownloadOutputs({ taskId });
  return (
    <Button
      variant="default"
      leftSection={<DownloadIcon size={16} />}
      onClick={() => handleDownload(outputIds)}
      loading={isDownloading}
      {...{ autoComplete: "off" }}
      disabled={disabled || outputIds.length === 0}
    >
      Download
    </Button>
  );
};
