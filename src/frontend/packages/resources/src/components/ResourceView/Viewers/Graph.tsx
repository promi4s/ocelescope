import { Box } from "@mantine/core";
import type { VisualizationProps } from "..";
import GraphFlow from "./GraphFlow";

const GraphViewer = (props: VisualizationProps<"graph">) => (
  <Box h="100%" w="100%" pos="relative" style={{ overflow: "hidden" }}>
    <GraphFlow {...props} />
  </Box>
);

export default GraphViewer;
