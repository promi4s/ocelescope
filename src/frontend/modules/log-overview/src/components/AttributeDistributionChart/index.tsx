import { useState } from "react";

import type { AttributeInfoType } from "../../api/base";
import { CategoricalFetcher } from "./CategoricalFetcher";
import { ChartTypeSelect } from "./ChartTypeSelect";
import { HistogramFetcher } from "./HistogramFetcher";
import { KdeFetcher } from "./KdeFetcher";
import type { ChartType, FetcherProps } from "./types";
import { ViolinFetcher } from "./ViolinFetcher";

const FETCHERS: Record<ChartType, (props: FetcherProps) => React.ReactElement> = {
  histogram: HistogramFetcher,
  kde: KdeFetcher,
  violin: ViolinFetcher,
  categorical: CategoricalFetcher,
};

const TYPE_OPTIONS: Record<AttributeInfoType, readonly { value: ChartType; label: string }[]> = {
  numeric: [
    { value: "histogram", label: "Histogram" },
    { value: "kde", label: "KDE" },
    { value: "violin", label: "Violin" },
  ],
  categorical: [{ value: "categorical", label: "Bar Chart" }],
};

const DEFAULT_TYPE: Record<AttributeInfoType, ChartType> = {
  numeric: "histogram",
  categorical: "categorical",
};

interface Props {
  ocelId: string;
  eventType: string;
  attribute: string;
  attributeType: AttributeInfoType;
}

export function AttributeDistributionChart({
  ocelId,
  eventType,
  attribute,
  attributeType,
}: Props) {
  const [chartType, setChartType] = useState<ChartType>(DEFAULT_TYPE[attributeType]);

  const options = TYPE_OPTIONS[attributeType];
  const controls =
    options.length > 1 ? (
      <ChartTypeSelect options={options} value={chartType} onChange={setChartType} />
    ) : null;

  const Fetcher = FETCHERS[chartType];

  return (
    <Fetcher
      ocelId={ocelId}
      eventType={eventType}
      attribute={attribute}
      sharedProps={{ title: eventType, subtitle: attribute, controls }}
    />
  );
}
