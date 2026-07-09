import { Alert, Code, LoadingOverlay, Stack } from "@mantine/core";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import type { VisualizationProps } from "../..";
import GraphControls from "./GraphControls";
import { useGraphExport } from "./hooks/useGraphExport";
import { useGraphLayout } from "./hooks/useGraphLayout";
import { FIT_VIEW_PADDING } from "./model/types";
import GraphFlowEdge from "./render/Edge";
import GraphFlowNode from "./render/Node";
import { computeAutoFitBounds } from "./utils/bounds";

const nodeTypes = { node: GraphFlowNode };
const edgeTypes = { graphflow: GraphFlowEdge };

const GraphFlowCanvas = ({
  visualization,
  isPreview,
  menuItems,
}: VisualizationProps<"graph">) => {
  const { nodes, edges, ready, error, onNodesChange } =
    useGraphLayout(visualization);

  const { fitBounds, getNodes, getEdges } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { downloadPng, downloadSvg, downloadPdf } = useGraphExport(wrapperRef);

  const fitViewWithEdges = useCallback(() => {
    fitBounds(computeAutoFitBounds(getNodes(), getEdges()), {
      padding: FIT_VIEW_PADDING,
    });
  }, [fitBounds, getNodes, getEdges]);

  // Fit the view once, the first time a layout becomes ready.
  const wasReadyRef = useRef(false);
  useEffect(() => {
    if (!ready) {
      wasReadyRef.current = false;
      return;
    }
    if (wasReadyRef.current) return;
    wasReadyRef.current = true;
    fitViewWithEdges();
  }, [ready, fitViewWithEdges]);

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
      <LoadingOverlay visible={!ready} zIndex={10} />
      <div
        ref={wrapperRef}
        style={{ width: "100%", height: "100%", opacity: ready ? 1 : 0 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={!isPreview}
          panOnDrag={!isPreview}
          minZoom={0.05}
          maxZoom={3}
        >
          {!isPreview && <Background color="#e5e7eb" gap={20} size={1} />}
          <GraphControls
            isPreview={isPreview}
            onFitView={fitViewWithEdges}
            onDownloadPng={downloadPng}
            onDownloadSvg={downloadSvg}
            onDownloadPdf={downloadPdf}
            menuItems={menuItems}
          />
        </ReactFlow>
      </div>
    </>
  );
};

const GraphFlow = (props: VisualizationProps<"graph">) => (
  <ReactFlowProvider>
    <GraphFlowCanvas {...props} />
  </ReactFlowProvider>
);

export default GraphFlow;
