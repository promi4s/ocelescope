import { EChartCard, type EChartCardProps } from "../EChartCard";
import { barChartOption } from "./chartOptions";
import type { BarChartData } from "./types";

export interface BarChartProps extends Omit<EChartCardProps, "option"> {
  data: BarChartData;
  stacked?: boolean;
  horizontal?: boolean;
}

export function BarChart({ data, stacked = false, horizontal = false, ...cardProps }: BarChartProps) {
  return <EChartCard {...cardProps} option={barChartOption(data, { stacked, horizontal })} />;
}
