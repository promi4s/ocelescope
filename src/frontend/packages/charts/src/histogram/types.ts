export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface HistogramStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  p25: number;
  p75: number;
}
