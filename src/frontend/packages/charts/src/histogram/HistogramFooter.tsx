import { Stack, Text } from "@mantine/core";

import { MissingNote } from "./MissingNote";
import type { HistogramData } from "./types";

export interface HistogramFooterProps {
  data: HistogramData;
}

export function HistogramFooter({ data }: HistogramFooterProps) {
  const nonMissing = data.counts.total - data.counts.missing;
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        {data.counts.covered.toLocaleString("en-US")} of{" "}
        {nonMissing.toLocaleString("en-US")} events in range
        {data.bins.length > 0 && ` · ${data.bins.length} bins`}
      </Text>
      <MissingNote missingCount={data.counts.missing} />
    </Stack>
  );
}
