import { EChartCard, type EChartCardProps } from "../EChartCard";
import { lineChartOption } from "./chartOptions";
import type { LineSeries } from "./types";

export interface LineChartProps extends Omit<EChartCardProps, "option"> {
  series: LineSeries[];
}

export function LineChart({ series, ...cardProps }: LineChartProps) {
  return <EChartCard {...cardProps} option={lineChartOption(series)} />;
}
