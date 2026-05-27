import { EChartCard, type EChartCardProps } from "../EChartCard";
import { violinChartOption } from "./chartOptions";
import type { LinePoint } from "../lineChart/types";
import type { ViolinStats } from "./types";

export interface ViolinChartProps extends Omit<EChartCardProps, "option"> {
  points: LinePoint[];
  stats: ViolinStats;
}

export function ViolinChart({ points, stats, ...cardProps }: ViolinChartProps) {
  return <EChartCard {...cardProps} option={violinChartOption(points, stats)} />;
}
