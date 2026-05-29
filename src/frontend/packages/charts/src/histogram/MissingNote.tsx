import { Alert, Text } from "@mantine/core";
import { TriangleAlertIcon } from "lucide-react";

export interface MissingNoteProps {
  missingCount: number;
}

export function MissingNote({ missingCount }: MissingNoteProps) {
  if (missingCount === 0) return null;
  return (
    <Alert color="yellow" icon={<TriangleAlertIcon size={14} />} p="xs">
      <Text size="xs">
        {missingCount.toLocaleString("en-US")} missing value
        {missingCount === 1 ? "" : "s"} excluded.
      </Text>
    </Alert>
  );
}
