import React, { ReactNode } from "react";
import {
  BaseEdge,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  getStraightPath,
  useInternalNode,
} from "@xyflow/react";
import { getEdgeParams } from "@/components/Graph/util/getEdgeParams";

export type FloatingEdgeType = Edge<
  {
    mid?: string;
    position?: {
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
    };
  },
  "floating"
>;

const EdgeLabel: React.FC<{
  transform: string;
  children: ReactNode;
}> = ({ transform, children }) => {
  return (
    <div
      style={{
        position: "absolute",
        fontSize: 10,
        fontWeight: 600,
        padding: "0 2px",
        transform,
        transformOrigin: "center",
        background: "white",
      }}
      className="nodrag nopan"
    >
      {children}
    </div>
  );
};

const customMarkes = ["url('#double-rect')", "url('#rect')"];

const FloatingEdge = ({
  data,
  source,
  target,
  markerEnd,
  ...props
}: EdgeProps<FloatingEdgeType>) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  const [edgePath, labelX, labelY, offsetX, offsetY] = getStraightPath(
    data?.position ?? {
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
    },
  );

  const angle =
    Math.atan2((sy > ty ? -1 : 1) * offsetY, offsetX) * (180 / Math.PI);

  return (
    <>
      <svg style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <marker
            id="rect-end"
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="5"
            orient="auto"
          >
            <rect x="2" y="2" width="6" height="6" fill="black" />
          </marker>
          <marker
            id="double-rect-end"
            markerWidth="14"
            markerHeight="10"
            refX="12" // ← adjust to move marker back or forward
            refY="5"
            orient="auto"
          >
            <rect x="2" y="2" width="4" height="6" fill="black" />
            <rect x="8" y="2" width="4" height="6" fill="black" />
          </marker>
          <marker
            id="rect"
            markerWidth="8"
            markerHeight="8"
            refX="3"
            refY="5"
            orient="auto"
          >
            <rect x="2" y="2" width="6" height="6" fill="black" />
          </marker>
          <marker
            id="double-rect"
            markerWidth="14"
            markerHeight="10"
            refX="2" // ← adjust to move marker back or forward
            refY="5"
            orient="auto"
          >
            <rect x="2" y="2" width="4" height="6" fill="black" />
            <rect x="8" y="2" width="4" height="6" fill="black" />
          </marker>
          <marker
            id="circle"
            markerWidth="8"
            markerHeight="8"
            refX="5"
            refY="5"
          >
            <circle cx="5" cy="5" r="3" fill="black" />
          </marker>
        </defs>
      </svg>
      <BaseEdge
        path={edgePath}
        markerEnd={
          customMarkes.includes(markerEnd ?? "")
            ? markerEnd?.replace("rect", "rect-end")
            : markerEnd
        }
        {...props}
      />
      <EdgeLabelRenderer>
        {data?.mid && (
          <EdgeLabel
            transform={`translate(-50% , -50%) translate(${labelX}px, ${labelY}px) rotate(${angle}deg)`}
          >
            {data?.mid}
          </EdgeLabel>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

export default FloatingEdge;
