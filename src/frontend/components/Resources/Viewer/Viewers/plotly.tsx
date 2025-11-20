import type { ComponentProps } from "react";
import type { VisualizationProps } from "..";
import dynamic from "next/dynamic";

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
      layout={{ ...layout, width: undefined, height: undefined }}
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
