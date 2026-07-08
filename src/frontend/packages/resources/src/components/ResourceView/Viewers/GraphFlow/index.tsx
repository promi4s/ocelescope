import { Alert, Code, LoadingOverlay, Stack } from "@mantine/core";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import type { VisualizationProps } from "../..";
import GraphControls from "./GraphControls";
import { useGraphExport } from "./hooks/useGraphExport";
import { useLayout } from "./hooks/useLayout";
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
  const { nodes, edges, layoutReady, error, onNodesChange } =
    useLayout(visualization);

  // React Flow silently drops any edge whose source/target node has not been
  // measured yet (no handle bounds in its internal store), and does not
  // reliably re-create it once measurement lands — so edges added before the
  // nodes settle stay "forgotten" until a remount/reload. This is most visible
  // right after a layout swaps the node set (e.g. filtering an OCEL). Holding
  // the edges back until every node is measured guarantees each edge is only
  // handed to React Flow against ready endpoints.
  const nodesInitialized = useNodesInitialized();
  const renderedEdges = nodesInitialized ? edges : [];

  const { fitBounds, getNodes, getEdges } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { downloadPng, downloadSvg, downloadPdf } = useGraphExport(wrapperRef);

  const fitViewWithEdges = useCallback(() => {
    fitBounds(computeAutoFitBounds(getNodes(), getEdges()), {
      padding: FIT_VIEW_PADDING,
    });
  }, [fitBounds, getNodes, getEdges]);

  const wasReadyRef = useRef(false);
  useEffect(() => {
    if (!layoutReady) {
      wasReadyRef.current = false;
      return;
    }
    if (wasReadyRef.current) return;
    wasReadyRef.current = true;

    fitViewWithEdges();
  }, [layoutReady, fitViewWithEdges]);

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
        ref={wrapperRef}
        style={{ width: "100%", height: "100%", opacity: layoutReady ? 1 : 0 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={renderedEdges}
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
