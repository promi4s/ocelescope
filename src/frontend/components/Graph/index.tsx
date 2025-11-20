import type React from "react";
import { type ComponentProps, useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  useEdgesState,
  type Node,
  type Edge,
  ReactFlowProvider,
  Controls,
  type NodeChange,
  applyNodeChanges,
} from "@xyflow/react";

import CircleNode, {
  type CircleNodeType,
} from "@/components/Graph/nodes/CircleNode";
import RectangleNode, {
  type RectangleNodeType,
} from "@/components/Graph/nodes/RectangleNode";
import FloatingEdge, { type FloatingEdgeType } from "./edges/FloatingEdge";
import { useDagreLayout } from "./layout/dagre";
import type { GraphLabel } from "@dagrejs/dagre";
import { useElkLayout } from "./layout/elk";
import LoopingEdge, { type LoopingEdgeType } from "./edges/LoopEdge";
import { ActionIcon } from "@mantine/core";
import { DownloadIcon } from "lucide-react";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";

const edgeTypes = {
  floating: FloatingEdge,
  looping: LoopingEdge,
};

const nodeTypes = {
  circle: CircleNode,
  rectangle: RectangleNode,
};

export type NodeComponents = Pick<
  CircleNodeType | RectangleNodeType,
  "id" | "data"
>;

export type EdgeComponents = Omit<
  FloatingEdgeType | LoopingEdgeType,
  "position" | "id" | "offset"
>;

type Layout =
  | {
      type: "dagre";
      options?: GraphLabel;
    }
  | { type: "elk"; options?: any };

const layoutToHook: Record<
  Layout["type"],
  typeof useDagreLayout | typeof useElkLayout
> = {
  elk: useElkLayout,
  dagre: useDagreLayout,
};

type Props = {
  initialNodes: NodeComponents[];
  initialEdges: EdgeComponents[];
  layoutOptions?: Layout;
};

const handleDownload = async (fileName: string) => {
  const flow = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!flow) return;

  const dataUrl = await toPng(flow, { backgroundColor: "white" });

  saveAs(dataUrl, `${fileName}.png`);
};

const InnerFlow: React.FC<Props> = ({
  initialNodes,
  initialEdges,
  layoutOptions = { type: "dagre" },
}) => {
  const [nodes, setNodes] = useState<Node[]>(
    initialNodes.map((node) => ({
      ...node,
      type: node.data.type,
      position: {
        x: 0,
        y: 0,
      },
    })),
  );

  const seenLoops: Record<string, number> = {};

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges.map((edge, index) => {
      const type = edge.source === edge.target ? "looping" : "floating";

      if (type === "looping") {
        seenLoops[edge.source] = (seenLoops[edge.source] ?? 0) + 1;
      }

      return {
        ...edge,
        id: `edge_${index}`,
        type,
        ...(type === "looping" && {
          data: { ...edge.data, offset: seenLoops[edge.source] },
        }),
      };
    }),
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positionChange = changes.filter(
        (change) => change.type === "position",
      );
      if (positionChange.length > 0) {
        const movedNodes = positionChange.map((change) => change.id);
        setEdges((edges) =>
          edges.map((edge) => ({
            ...edge,
            data: {
              ...edge.data,
              position:
                movedNodes.includes(edge.target) ||
                movedNodes.includes(edge.source)
                  ? undefined
                  : edge.data?.position,
            },
          })),
        );
      }

      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setEdges],
  );

  const { layout } = layoutToHook[layoutOptions.type]();

  const hasMeasuredNodes = nodes.some(({ measured }) => !!measured);

  useEffect(() => {
    if (hasMeasuredNodes) {
      void layout(layoutOptions?.options);
    }
  }, [layout, layoutOptions, hasMeasuredNodes]);

  return (
    <ReactFlow
      style={{ height: "100%" }}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      edgeTypes={edgeTypes}
      nodeTypes={nodeTypes}
      minZoom={0.1}
      nodesDraggable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Controls showInteractive={false}>
        {
          //TODO: Make file name actual ocel name
        }
        <ActionIcon
          variant="transparent"
          onClick={() => handleDownload("ocelot")}
        >
          <DownloadIcon color={"black"} size={18} />
        </ActionIcon>
      </Controls>
    </ReactFlow>
  );
};

const Graph: React.FC<ComponentProps<typeof InnerFlow>> = (props) => (
  <ReactFlowProvider>
    <InnerFlow {...props} />
  </ReactFlowProvider>
);

export default Graph;
