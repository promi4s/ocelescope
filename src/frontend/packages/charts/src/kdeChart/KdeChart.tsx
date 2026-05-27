import { EChartCard, type EChartCardProps } from "../EChartCard";
import { kdeChartOption } from "./chartOptions";
import type { LinePoint } from "../lineChart/types";

export interface KdeChartProps extends Omit<EChartCardProps, "option"> {
  points: LinePoint[];
}

export function KdeChart({ points, ...cardProps }: KdeChartProps) {
  return <EChartCard {...cardProps} option={kdeChartOption(points)} />;
}
