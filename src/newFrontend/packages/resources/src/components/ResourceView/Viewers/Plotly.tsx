import type { ComponentProps } from "react";
import dynamic from "next/dynamic";
import type { VisualizationProps } from "../../../types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const PlotlyViewer: React.FC<VisualizationProps<"plotly">> = ({
  visualization,
  isPreview,
}) => {
  const { data, layout } = visualization.data as Pick<
    ComponentProps<typeof Plot>,
    "data" | "layout"
  >;

  return (
    <Plot
      data={data}
      layout={{ ...layout }}
      config={{
        responsive: true,
        displaylogo: false,
        staticPlot: !!isPreview,
        showTips: false,
      }}
      useResizeHandler={true}
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default PlotlyViewer;
