import { VisualizationByType } from "@/types/outputs";
import { Box } from "@mantine/core";
import { ElementDefinition } from "cytoscape";
import CytoscapeComponent from "@/components/Cytoscape";
import ActionButtons from "@/components/Cytoscape/components/ActionButtons";

const GraphViewer: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean;
}> = ({ visualization, isPreview }) => {
  const nodes: ElementDefinition[] = visualization.nodes.map((node) => ({
    data: {
      id: node.id,
    },
    css: {
      shape: node.shape,
      label: node.label ?? undefined,
      "text-valign": node.label_pos ?? "center",
      "text-halign": "center",
      width: node.width ?? undefined,
      "background-color": node.color ?? undefined,
      height: node.height ?? undefined,
      ...(node.border_color && {
        "border-width": 2, // border thickness in pixels
        "border-color": "#000000", // border color
        "border-style": "solid", // optional: solid, dotted, dashed
      }),
    },
    position: { x: node.x ?? 0, y: node.y ?? 0 },
  }));

  const edges: ElementDefinition[] = visualization.edges.map((edge, index) => ({
    data: {
      id: index.toString(),
      source: edge.source,
      target: edge.target,
      label: edge.label ?? "",
    },
    css: {
      "line-color": edge.color ?? "#ccc",
      "target-arrow-shape": edge.arrows[1] ?? undefined,
      "target-arrow-color": edge.color ?? "#ccc",
      "source-arrow-shape": edge.arrows[0] ?? undefined,
      "source-arrow-color": edge.color ?? "#ccc",
      "arrow-scale": 1.5,
      "curve-style": "bezier", // ensures arrows are visible at ends
      label: edge.label ?? "",
      "text-rotation": "autorotate", // rotate label along edge
      "font-size": 12,
    },
  }));

  return (
    <Box h={"100%"} w={"100%"} pos={"relative"}>
      <CytoscapeComponent
        userZoomingEnabled={!isPreview}
        userPanningEnabled={!isPreview}
        style={{ width: "100%", height: "100%" }}
        elements={[...nodes, ...edges]}
        layout={{ name: "preset" }}
      >
        {!isPreview && <ActionButtons />}
      </CytoscapeComponent>
    </Box>
  );
};
export default GraphViewer;
