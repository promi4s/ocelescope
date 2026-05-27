import { Skeleton } from "@mantine/core";
import { ChartCard, KdeChart } from "@ocelescope/charts";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";

import { useEventAttributeKde } from "../../api/base";
import { MissingNote } from "./Notes";
import { SmoothingSlider } from "./SmoothingSlider";
import type { FetcherProps } from "./types";

export function KdeFetcher({ ocelId, eventType, attribute, sharedProps }: FetcherProps) {
  const [bandwidth, setBandwidth] = useState(1);
  const { data, isLoading } = useEventAttributeKde(
    ocelId,
    eventType,
    attribute,
    { bandwidth },
    { query: { placeholderData: keepPreviousData } },
  );

  const settings = <SmoothingSlider value={bandwidth} onChange={setBandwidth} />;

  if (isLoading || !data) {
    return (
      <ChartCard {...sharedProps}>
        <Skeleton h="100%" />
      </ChartCard>
    );
  }

  return (
    <KdeChart
      {...sharedProps}
      points={data.points}
      settings={settings}
      note={<MissingNote missingCount={data.missing_count} />}
    />
  );
}
