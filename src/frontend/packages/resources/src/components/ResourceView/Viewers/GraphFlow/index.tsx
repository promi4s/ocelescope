import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ActionIcon,
  Alert,
  Code,
  LoadingOverlay,
  Menu,
  Stack,
} from "@mantine/core";
import { useCallback, useEffect, useRef } from "react";
import { DownloadIcon, Maximize2Icon } from "lucide-react";
import { computeAutoFitBounds } from "./utils/bounds";
import { downloadPdf, downloadPng, downloadSvg } from "./utils/download";

import type { VisualizationByType } from "../../../../types";
import { FIT_VIEW_PADDING } from "./constants/graphFlow";
import { useGraphFlowLayout } from "./hooks/useGraphFlowLayout";
import { edgeTypes, nodeTypes } from "./utils/reactFlowTypes";

type GraphFlowProps = {
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
};

const GraphFlowCanvas = ({ visualization, isPreview }: GraphFlowProps) => {
  const { nodes, edges, layoutReady, error, onNodesChange } =
    useGraphFlowLayout(visualization);

  const { fitBounds, getNodes, getEdges, getNodesBounds } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fitViewWithEdges = useCallback(() => {
    fitBounds(computeAutoFitBounds(getNodes(), getEdges()), {
      padding: FIT_VIEW_PADDING,
    });
  }, [fitBounds, getNodes, getEdges]);

  const handleDownloadPng = useCallback(
    () =>
      wrapperRef.current &&
      downloadPng(wrapperRef.current, getNodes(), getNodesBounds),
    [getNodes, getNodesBounds],
  );
  const handleDownloadSvg = useCallback(
    () =>
      wrapperRef.current &&
      downloadSvg(wrapperRef.current, getNodes(), getNodesBounds),
    [getNodes, getNodesBounds],
  );
  const handleDownloadPdf = useCallback(
    () =>
      wrapperRef.current &&
      downloadPdf(wrapperRef.current, getNodes(), getNodesBounds),
    [getNodes, getNodesBounds],
  );

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
          {!isPreview && (
            <>
              <Background color="#e5e7eb" gap={20} size={1} />
              <Controls showInteractive={false} showFitView={false}>
                <ControlButton onClick={fitViewWithEdges} title="fit view">
                  <Maximize2Icon size={11} />
                </ControlButton>
                <Menu position="right" withinPortal={false}>
                  <Menu.Target>
                    <ActionIcon variant="transparent">
                      <DownloadIcon color="black" size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={handleDownloadPng}>PNG</Menu.Item>
                    <Menu.Item onClick={handleDownloadSvg}>SVG</Menu.Item>
                    <Menu.Item onClick={handleDownloadPdf}>PDF</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
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
