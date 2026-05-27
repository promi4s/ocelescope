import { EChartCard, type EChartCardProps } from "../EChartCard";
import { histogramOption } from "./chartOptions";
import type { HistogramBin } from "./types";

export interface HistogramProps extends Omit<EChartCardProps, "option"> {
  bins: HistogramBin[];
}

export function Histogram({ bins, ...cardProps }: HistogramProps) {
  return <EChartCard {...cardProps} option={histogramOption(bins)} />;
}
