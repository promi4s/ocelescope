import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Alert, Code, LoadingOverlay, Stack } from "@mantine/core";
import { useEffect } from "react";

import type { VisualizationByType } from "../../../../types";
import { FIT_VIEW_PADDING } from "./constants/graphFlow";
import { useGraphFlowLayout } from "./hooks/useGraphFlowLayout";
import { edgeTypes, nodeTypes } from "./utils/reactFlowTypes";

type GraphFlowProps = {
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
};

const GraphFlowCanvas = ({ visualization, isPreview }: GraphFlowProps) => {
  const { nodes, edges, layoutReady, fitViewVersion, error, onNodesChange } =
    useGraphFlowLayout(visualization);

  const { fitView } = useReactFlow();

  // Fit the viewport after each completed layout. Using useEffect (post-commit)
  // ensures React has applied all node positions to the DOM before fitView runs,
  // avoiding the race condition of requestAnimationFrame inside async callbacks.
  useEffect(() => {
    if (fitViewVersion === 0) return;
    fitView({ padding: FIT_VIEW_PADDING });
  }, [fitViewVersion, fitView]);

  if (error) {
    return (
      <Stack h="100%" justify="center" p="md">
        <Alert color="red" title={error.message}>
          {error.details?.map((detail) => (
            <Code key={detail} display="block" mb={4}>
              {detail}
            </Code>
          ))}
        </Alert>
      </Stack>
    );
  }

  return (
    <>
      <LoadingOverlay visible={!layoutReady} zIndex={10} />
      <div
        style={{ width: "100%", height: "100%", opacity: layoutReady ? 1 : 0 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!isPreview}
          zoomOnScroll={!isPreview}
          panOnDrag={!isPreview}
          fitViewOptions={{ padding: FIT_VIEW_PADDING }}
          minZoom={0.05}
          maxZoom={3}
        >
          {!isPreview && (
            <>
              <Background color="#e5e7eb" gap={20} size={1} />
              <Controls showInteractive={false} />
            </>
          )}
        </ReactFlow>
      </div>
    </>
  );
};

const GraphFlow = (props: GraphFlowProps) => (
  <ReactFlowProvider>
    <GraphFlowCanvas {...props} />
  </ReactFlowProvider>
);

export default GraphFlow;
