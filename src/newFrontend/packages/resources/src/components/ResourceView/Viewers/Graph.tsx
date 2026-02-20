import CytoscapeComponent from "../../../components/Cytoscape";
import ActionButtons from "../../../components/Cytoscape/components/ActionButtons";
import FloatingAnnotation from "../../../components/Cytoscape/components/FloatingAnnotation";
import type { VisualizationByType, VisulizationsType } from "../../../types";
import { Box } from "@mantine/core";
import VisualizationViewer from "..";
import { useGraphvizLayout } from "../../../hooks/useGraphvizLayout";

const GraphViewer: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean;
}> = ({ visualization, isPreview }) => {
  const { elements } = useGraphvizLayout(visualization);

  return (
    <Box h={"100%"} w={"100%"} pos={"relative"} style={{ overflow: "hidden" }}>
      {elements && (
        <CytoscapeComponent
          userZoomingEnabled={!isPreview}
          userPanningEnabled={!isPreview}
          style={{ width: "100%", height: "100%" }}
          elements={elements}
          layout={{ name: "preset" }}
        >
          {!isPreview && (
            <>
              <ActionButtons />
              <FloatingAnnotation>
                {(entity) => {
                  const visualizationEntity = visualization[
                    entity.type === "edge" ? "edges" : "nodes"
                  ]?.find(({ id }) => id === entity.id);

                  if (!visualizationEntity?.annotation) return;

                  return (
                    <VisualizationViewer
                      visualization={
                        visualizationEntity.annotation as VisulizationsType
                      }
                      isPreview
                    />
                  );
                }}
              </FloatingAnnotation>
            </>
          )}
        </CytoscapeComponent>
      )}
    </Box>
  );
};
export default GraphViewer;
