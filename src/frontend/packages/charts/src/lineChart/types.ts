export interface LinePoint {
  x: number;
  y: number;
}

export interface LineSeries {
  name: string;
  points: LinePoint[];
  smooth?: boolean;
  area?: boolean;
}
