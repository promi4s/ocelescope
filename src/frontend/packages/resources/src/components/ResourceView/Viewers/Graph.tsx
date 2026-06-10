import { Box } from "@mantine/core";
import type { VisualizationByType } from "../../../types";
import GraphFlow from "./GraphFlow";

const GraphViewer: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
}> = ({ visualization, isPreview }) => (
  <Box h="100%" w="100%" pos="relative" style={{ overflow: "hidden" }}>
    <GraphFlow visualization={visualization} isPreview={isPreview} />
  </Box>
);

export default GraphViewer;
