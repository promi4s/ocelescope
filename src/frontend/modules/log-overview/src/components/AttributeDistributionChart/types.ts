import type { ReactNode } from "react";

export type ChartType = "histogram" | "kde" | "violin" | "categorical";

export interface SharedChartProps {
  title: string;
  subtitle: string;
  controls: ReactNode;
}

export interface FetcherProps {
  ocelId: string;
  eventType: string;
  attribute: string;
  sharedProps: SharedChartProps;
}
