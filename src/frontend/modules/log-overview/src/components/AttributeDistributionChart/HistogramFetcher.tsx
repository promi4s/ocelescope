import { NumberInput, Skeleton } from "@mantine/core";
import { ChartCard, Histogram } from "@ocelescope/charts";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";

import { useEventAttributeHistogram } from "../../api/base";
import { MissingNote } from "./Notes";
import type { FetcherProps } from "./types";

export function HistogramFetcher({ ocelId, eventType, attribute, sharedProps }: FetcherProps) {
  const [bins, setBins] = useState<number | null>(null);
  const { data, isLoading } = useEventAttributeHistogram(
    ocelId,
    eventType,
    attribute,
    { bins },
    { query: { placeholderData: keepPreviousData } },
  );

  const settings = (
    <NumberInput
      label="Bins"
      size="xs"
      placeholder="Auto"
      min={1}
      max={500}
      value={bins ?? ""}
      onChange={(v) => setBins(v === "" ? null : Number(v))}
    />
  );

  if (isLoading || !data) {
    return (
      <ChartCard {...sharedProps}>
        <Skeleton h="100%" />
      </ChartCard>
    );
  }

  return (
    <Histogram
      {...sharedProps}
      bins={data.bins}
      settings={settings}
      note={<MissingNote missingCount={data.missing_count} />}
    />
  );
}
