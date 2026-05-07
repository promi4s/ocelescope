import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Alert, Code, LoadingOverlay, Stack, ActionIcon } from "@mantine/core";
import { useCallback, useEffect, useRef } from "react";
import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import { DownloadIcon } from "lucide-react";

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

  const { fitView, getNodes } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!wrapperRef.current) return;

    const allNodes = getNodes();
    if (allNodes.length === 0) return;

    // Compute the bounding box of all nodes, then derive a viewport transform
    // that fits everything into the output image — independent of current pan/zoom.
    const bounds = getNodesBounds(allNodes);
    const MAX_PX = 2048;
    const scale = Math.min(MAX_PX / bounds.width, MAX_PX / bounds.height);
    const imageWidth = Math.ceil(bounds.width * scale);
    const imageHeight = Math.ceil(bounds.height * scale);

    const { x, y, zoom } = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.01,
      10,
      0.05, // 5% padding inside the image
    );

    const viewportEl = wrapperRef.current.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!viewportEl) return;

    // Override the viewport transform for the capture only — the live view is unchanged.
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: "#ffffff",
      width: imageWidth,
      height: imageHeight,
      skipFonts: true, // avoids fetching/embedding font files — biggest perf win
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      },
      filter: (node) =>
        !(node instanceof Element) ||
        (!node.classList.contains("react-flow__panel") &&
          !node.classList.contains("react-flow__background")),
    });

    saveAs(dataUrl, "graph.png");
  }, [getNodes]);

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
        ref={wrapperRef}
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
          elementsSelectable={false}
          zoomOnScroll={!isPreview}
          panOnDrag={!isPreview}
          fitViewOptions={{ padding: FIT_VIEW_PADDING }}
          minZoom={0.05}
          maxZoom={3}
        >
          {!isPreview && (
            <>
              <Background color="#e5e7eb" gap={20} size={1} />
              <Controls showInteractive={false}>
                <ActionIcon
                  variant="transparent"
                  onClick={handleDownload}
                >
                  <DownloadIcon color={"black"} size={18} />
                </ActionIcon>
              </Controls>
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
