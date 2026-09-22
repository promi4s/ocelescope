import { Button } from "@mantine/core";
import { DownloadIcon } from "lucide-react";
import { useDownload } from "../../hooks/useDownload";

export const DownloadAction = ({
  taskId,
  selected = [],
  disabled,
}: {
  taskId: string;
  selected?: number[];
  disabled?: boolean;
}) => {
  const { handleDownload, isDownloading } = useDownload({ taskId });
  return (
    <Button
      variant="default"
      leftSection={<DownloadIcon size={16} />}
      onClick={() => handleDownload(selected)}
      loading={isDownloading}
      {...{ autoComplete: "off" }}
      disabled={disabled || selected.length === 0}
    >
      Download
    </Button>
  );
};
