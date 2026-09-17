import { ActionIcon, Tooltip } from "@mantine/core";
import { Columns2Icon, Rows2Icon } from "lucide-react";

export const OrientationAction = ({
  isHorizontal,
  toggleOrientation,
}: {
  isHorizontal: boolean;
  toggleOrientation: () => void;
}) => {
  return (
    <Tooltip label={!isHorizontal ? "Show side by side" : "Stack vertically"}>
      <ActionIcon variant="default" size="lg" onClick={toggleOrientation}>
        {!isHorizontal ? <Columns2Icon size={16} /> : <Rows2Icon size={16} />}
      </ActionIcon>
    </Tooltip>
  );
};
