import { VisualizationByType, VisulizationsType } from "@/types/resources";
import { Box, Paper } from "@mantine/core";
import CytoscapeComponent from "@/components/Cytoscape";
import ActionButtons from "@/components/Cytoscape/components/ActionButtons";
import { useGraphvizLayout } from "@/hooks/useGraphvizLayout";
import EntityAnnotation from "@/components/Cytoscape/components/Annotation";
import { useMemo } from "react";
import { Visualization } from "..";

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
              <EntityAnnotation trigger="leftClick">
                {({ entity }) => {
                  const annotation = useMemo(() => {
                    if (entity?.type === "node") {
                      return visualization.nodes.find(
                        ({ id }) => entity.id === id,
                      )?.annotation;
                    }
                  }, [entity]);

                  const position = useMemo(
                    () => ({
                      x:
                        entity?.type === "node"
                          ? entity.boundingBox.x2
                          : entity?.midpoint.x,

                      y:
                        entity?.type === "node"
                          ? entity.boundingBox.y1
                          : entity?.midpoint.y,
                    }),
                    [entity],
                  );

                  if (!entity || !annotation) {
                    return;
                  }

                  return (
                    <Paper
                      shadow="xs"
                      p={"md"}
                      style={{
                        position: "absolute",
                        left: position.x,
                        top: position.y,
                      }}
                    >
                      <Visualization
                        visualization={annotation as VisulizationsType}
                      />
                    </Paper>
                  );
                }}
              </EntityAnnotation>
            </>
          )}
        </CytoscapeComponent>
      )}
    </Box>
  );
};
export default GraphViewer;
