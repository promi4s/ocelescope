import { Background, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { VisualizationByType } from "../../../../types";
import { FIT_VIEW_PADDING } from "./constants/graphFlow";
import { useGraphFlowLayout } from "./hooks/useGraphFlowLayout";
import { edgeTypes, nodeTypes } from "./utils/reactFlowTypes";

type GraphFlowProps = {
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
};

const GraphFlowCanvas = ({ visualization, isPreview }: GraphFlowProps) => {
  const { nodes, edges, onNodesChange } = useGraphFlowLayout(visualization);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      nodesDraggable={!isPreview}
      nodesConnectable={false}
      elementsSelectable={!isPreview}
      zoomOnScroll={!isPreview}
      panOnDrag={!isPreview}
      fitView
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
  );
};

const GraphFlow = (props: GraphFlowProps) => (
  <ReactFlowProvider>
    <GraphFlowCanvas {...props} />
  </ReactFlowProvider>
);

export default GraphFlow;
