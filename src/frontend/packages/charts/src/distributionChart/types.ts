export interface DistributionData {
  values: number[];
  missingCount?: number;
}

export interface DistributionChartProps {
  data: DistributionData;
  title: string;
  subtitle?: string;
}

export type DistributionDisplayMode = "histogram" | "kde" | "both";

export interface HistBin {
  lower: number;
  upper: number;
  center: number;
  count: number;
  density: number;
  label: string;
}
