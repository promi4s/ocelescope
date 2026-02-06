import type React from "react";
import type { ComponentProps } from "react";
import { BaseEdge as FlowBaseEdge, EdgeLabelRenderer } from "@xyflow/react";

export const EdgeLabel: React.FC<{
  transform: string;
  label: string;
}> = ({ transform, label }) => {
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
      {label}
    </div>
  );
};

const customMarkes = ["url('#double-rect')", "url('#rect')"];

const BaseEdge: React.FC<
  { labels?: ComponentProps<typeof EdgeLabel>[] } & ComponentProps<
    typeof FlowBaseEdge
  >
> = ({ labels = [], markerEnd, path, ...rest }) => {
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
      <FlowBaseEdge
        path={path}
        markerEnd={
          customMarkes.includes(markerEnd ?? "")
            ? markerEnd?.replace("rect", "rect-end")
            : markerEnd
        }
        {...rest}
      />
      <EdgeLabelRenderer>
        {labels.map((props, index) => (
          <EdgeLabel key={index} {...props} />
        ))}
      </EdgeLabelRenderer>
    </>
  );
};

export default BaseEdge;
