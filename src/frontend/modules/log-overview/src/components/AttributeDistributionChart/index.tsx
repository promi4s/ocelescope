import type { HistogramBin, HistogramRange } from "@ocelescope/charts";
import { Histogram } from "@ocelescope/charts";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useEventAttributeHistogram } from "../../api/base";
import { AttributeDrillDown } from "./AttributeDrillDown";
import { toHistogramData } from "./mapper";

interface Props {
  ocelId: string;
  eventType: string;
  attribute: string;
}

const EMPTY_RANGE: HistogramRange = { min: null, max: null };

export function AttributeDistributionChart({
  ocelId,
  eventType,
  attribute,
}: Props) {
  const [range, setRange] = useState<HistogramRange>(EMPTY_RANGE);
  const [bins, setBins] = useState<number | null>(null);
  const [selectedBin, setSelectedBin] = useState<HistogramBin | null>(null);

  const { data, isLoading } = useEventAttributeHistogram(
    ocelId,
    eventType,
    attribute,
    { range, bins },
    undefined,
    { query: { placeholderData: keepPreviousData } },
  );

  const chartData = useMemo(
    () => (data ? toHistogramData(data) : null),
    [data],
  );

  return (
    <Histogram
      title={eventType}
      subtitle={attribute}
      filename={`${eventType}-${attribute}-histogram`}
      data={isLoading ? null : chartData}
      bins={bins}
      range={range}
      onBinsChange={setBins}
      onRangeChange={setRange}
      selectedBin={selectedBin}
      onSelectedBinChange={setSelectedBin}
      renderDrillDown={(bin) => (
        <AttributeDrillDown
          ocelId={ocelId}
          eventType={eventType}
          attribute={attribute}
          bin={bin}
        />
      )}
    />
  );
}
