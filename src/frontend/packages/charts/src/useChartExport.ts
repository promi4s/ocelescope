import type ReactEChartsType from "echarts-for-react";
import { type RefObject, useCallback } from "react";

import type { ChartExportFormat } from "./types";

function download(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

function rasterizeSvg(svgUrl: string, filename: string) {
  const image = new Image();
  image.onload = () => {
    const pixelRatio = 2;
    const canvas = document.createElement("canvas");
    canvas.width = image.width * pixelRatio;
    canvas.height = image.height * pixelRatio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(pixelRatio, pixelRatio);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, image.width, image.height);
    context.drawImage(image, 0, 0);
    download(canvas.toDataURL("image/png"), filename);
  };
  image.src = svgUrl;
}

export function useChartExport(
  chartRef: RefObject<ReactEChartsType | null>,
  filename: string,
) {
  return useCallback(
    (format: ChartExportFormat) => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      const svgUrl = instance.getDataURL({
        type: "svg",
        pixelRatio: 1,
      });
      if (format === "svg") {
        download(svgUrl, `${filename}.svg`);
      } else {
        rasterizeSvg(svgUrl, `${filename}.png`);
      }
    },
    [chartRef, filename],
  );
}
