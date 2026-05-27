import { Skeleton, Stack } from "@mantine/core";
import { BarChart, ChartCard } from "@ocelescope/charts";
import type { BarChartData } from "@ocelescope/charts";

import { useEventAttributeCategorical } from "../../api/base";
import { MissingNote, TruncatedNote } from "./Notes";
import type { FetcherProps } from "./types";

export function CategoricalFetcher({ ocelId, eventType, attribute, sharedProps }: FetcherProps) {
  const { data, isLoading } = useEventAttributeCategorical(ocelId, eventType, attribute, {});

  if (isLoading || !data) {
    return (
      <ChartCard {...sharedProps}>
        <Skeleton h="100%" />
      </ChartCard>
    );
  }

  const barData: BarChartData = {
    categories: data.value_counts.map((vc) => vc.value),
    series: [{ name: "Count", data: data.value_counts.map((vc) => vc.count) }],
  };

  const note = (
    <Stack gap="xs">
      <MissingNote missingCount={data.missing_count} />
      {data.truncated && <TruncatedNote valueCount={data.value_counts.length} />}
    </Stack>
  );

  return (
    <BarChart
      {...sharedProps}
      data={barData}
      horizontal={data.value_counts.length > 6}
      note={note}
    />
  );
}
