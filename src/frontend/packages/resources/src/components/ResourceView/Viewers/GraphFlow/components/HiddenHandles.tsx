import { Handle, Position } from "@xyflow/react";

const hiddenHandleStyle = { opacity: 0, pointerEvents: "none" } as const;

type HiddenHandlesProps = {
  source?: Position;
  target?: Position;
};

export const HiddenHandles = ({
  source = Position.Right,
  target = Position.Left,
}: HiddenHandlesProps) => (
  <>
    <Handle type="target" position={target} style={hiddenHandleStyle} />
    <Handle type="source" position={source} style={hiddenHandleStyle} />
  </>
);
