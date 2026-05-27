import { Alert, Text } from "@mantine/core";
import { TriangleAlertIcon } from "lucide-react";

export function MissingNote({ missingCount }: { missingCount: number }) {
  if (missingCount === 0) return null;
  return (
    <Alert color="yellow" icon={<TriangleAlertIcon size={14} />} p="xs">
      <Text size="xs">
        {missingCount.toLocaleString("en-US")} missing value{missingCount === 1 ? "" : "s"} excluded.
      </Text>
    </Alert>
  );
}

export function TruncatedNote({ valueCount }: { valueCount: number }) {
  return (
    <Alert color="blue" icon={<TriangleAlertIcon size={14} />} p="xs">
      <Text size="xs">Showing top {valueCount} values.</Text>
    </Alert>
  );
}
