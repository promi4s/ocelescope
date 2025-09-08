import { VisualizationByType } from "@/types/outputs";
import { Box } from "@mantine/core";
import CytoscapeComponent from "@/components/Cytoscape";
import ActionButtons from "@/components/Cytoscape/components/ActionButtons";
import { useGraphvizLayout } from "@/hooks/useGraphvizLayout";

const GraphViewer: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean;
}> = ({ visualization, isPreview }) => {
  const { elements } = useGraphvizLayout(visualization);

  return (
    <Box h={"100%"} w={"100%"} pos={"relative"}>
      {elements && (
        <CytoscapeComponent
          userZoomingEnabled={!isPreview}
          userPanningEnabled={!isPreview}
          style={{ width: "100%", height: "100%" }}
          elements={elements}
          layout={{ name: "preset" }}
        >
          {!isPreview && <ActionButtons />}
        </CytoscapeComponent>
      )}
    </Box>
  );
};
export default GraphViewer;
