import { Center, Skeleton, Text } from "@mantine/core";
import { ChartCard, ViolinChart } from "@ocelescope/charts";

import { useEventAttributeViolin } from "../../api/base";
import { MissingNote } from "./Notes";
import type { FetcherProps } from "./types";

export function ViolinFetcher({ ocelId, eventType, attribute, sharedProps }: FetcherProps) {
  const { data, isLoading } = useEventAttributeViolin(ocelId, eventType, attribute, {});

  if (isLoading || !data) {
    return (
      <ChartCard {...sharedProps}>
        <Skeleton h="100%" />
      </ChartCard>
    );
  }

  if (!data.stats) {
    return (
      <ChartCard {...sharedProps}>
        <Center h="100%">
          <Text c="dimmed" size="sm">
            Not enough data for a violin plot.
          </Text>
        </Center>
      </ChartCard>
    );
  }

  return (
    <ViolinChart
      {...sharedProps}
      points={data.kde_points}
      stats={data.stats}
      note={<MissingNote missingCount={data.missing_count} />}
    />
  );
}
