import { Box } from "@mantine/core";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
import { memo } from "react";

export type RectangleNodeType = Node<
  {
    type: "rectangle";
    color?: string;
    label?: string | React.ReactNode;
    inner?: string | React.ReactNode;
  },
  "rectangle"
>;

export default memo(
  ({ data: { color, label, inner } }: NodeProps<RectangleNodeType>) => {
    return (
      <>
        <Handle type="source" position={Position.Bottom} />
        <Box style={{ position: "relative", display: "inline-block" }}>
          <Box
            style={{
              backgroundColor: color,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "auto",
              height: "auto",
            }}
          >
            {inner}
          </Box>

          <Box
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginTop: 4,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Box>
        </Box>
        <Handle type="target" position={Position.Top} />
      </>
    );
  },
);
