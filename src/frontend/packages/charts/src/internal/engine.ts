import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  SunburstChart,
} from "echarts/charts";
import {
  AriaComponent,
  BrushComponent,
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

/** Register only the engine features used by the package. */
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  PieChart,
  SunburstChart,
  DatasetComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  BrushComponent,
  AriaComponent,
  LabelLayout,
  SVGRenderer,
]);

export { echarts };

import type { EChartsOption } from "echarts";
import type { ChartSelection, ChartTheme } from "../types";

/** The ECharts click payload, narrowed to the fields builders rely on. */
export interface ClickParams {
  treePathInfo?: Array<{ name?: string }>;
  dataIndex?: number;
  seriesName?: string;
  seriesIndex?: number;
  name?: string;
  value?: unknown;
  data?: unknown;
}

/**
 * What a chart type produces: the option plus how to read a click back into
 * the data contract. Keeping `select` next to the option is what lets the host
 * stay generic - it never needs to know how a chart was encoded.
 */
export interface BuiltChart {
  option: EChartsOption;
  select?: (params: ClickParams) => ChartSelection | undefined;
}

/** Every chart type is `(props, theme) => built chart`. Pure and testable. */
export type OptionBuilder<P> = (props: P, theme: ChartTheme) => BuiltChart;

export type ChartEventHandler = (...args: unknown[]) => void;
export type ChartEventMap = Record<string, ChartEventHandler>;

function download(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

function rasterizeSvg(svgUrl: string, filename: string, background: string) {
  const image = new Image();
  image.onload = () => {
    const pixelRatio = 2;
    const canvas = document.createElement("canvas");
    canvas.width = image.width * pixelRatio;
    canvas.height = image.height * pixelRatio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(pixelRatio, pixelRatio);
    context.fillStyle = background;
    context.fillRect(0, 0, image.width, image.height);
    context.drawImage(image, 0, 0);
    download(canvas.toDataURL("image/png"), filename);
  };
  image.src = svgUrl;
}

export function exportImage(
  instance: import("echarts").EChartsType,
  format: "png" | "svg",
  filename: string,
  background: string,
) {
  const url = instance.getDataURL({ type: "svg", pixelRatio: 1 });
  if (format === "svg") download(url, `${filename}.svg`);
  else rasterizeSvg(url, `${filename}.png`, background);
}
