export type FrequencyDatumKind = "value" | "missing" | "other";

export interface FrequencyDatum {
  label: string;
  value: number;
  kind?: FrequencyDatumKind;
}

export interface HistogramData {
  bins: FrequencyDatum[];
  missing?: FrequencyDatum;
}

export interface FrequencyChartColors {
  primary: string;
  missing: string;
  other: string;
}

export interface FrequencyChartConfig {
  seriesName?: string;
  valueAxisName?: string;
  colors?: Partial<FrequencyChartColors>;
}

export interface CartesianFrequencyChartConfig extends FrequencyChartConfig {
  rotateLabelsAfter?: number;
}

export interface HierarchyDatum {
  label: string;
  value?: number;
  children?: HierarchyDatum[];
  color?: string;
  tooltipValue?: number;
  tooltipValueName?: string;
  tooltipPercentage?: number;
}

export interface SunburstChartConfig {
  seriesName?: string;
  valueName?: string;
  colors?: string[];
}

export interface StackedBarDatum {
  category: string;
  fullCategory?: string;
  series: string;
  value: number;
}

export interface HorizontalStackedBarChartConfig {
  valueName?: string;
  categoryAxisName?: string;
  colors?: string[];
  percentageTotal?: number;
  interactiveLegend?: boolean;
}

export interface StackedBarChartConfig {
  valueName?: string;
  categoryAxisName?: string;
  colors?: string[];
  interactiveLegend?: boolean;
  rotateLabelsAfter?: number;
  valueUnit?: {
    singular: string;
    plural: string;
  };
}
