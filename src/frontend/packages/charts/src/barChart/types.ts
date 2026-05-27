export interface BarSeries {
  name: string;
  data: number[];
}

export interface BarChartData {
  categories: string[];
  series: BarSeries[];
}
