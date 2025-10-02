import {
  Edge,
  EdgeProps,
  getSmoothStepPath,
  Position,
  useInternalNode,
} from "@xyflow/react";
import BaseEdge from "./BaseEdge";

export type LoopingEdgeType = Edge<
  {
    mid?: string;
    offset: number;
  },
  "looping"
>;

const LoopingEdge = ({
  data,
  source,
  ...props
}: EdgeProps<LoopingEdgeType>) => {
  const { position, measured } = useInternalNode(source) ?? {
    position: { x: 0, y: 0 },
    measured: { width: 0 },
  };
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: position.x,
    sourceY: position.y,
    targetX: position.x + (measured.width ?? 0),
    targetY: position.y,
    sourcePosition: Position.Top,
    targetPosition: Position.Top,
    offset: (data?.offset ?? 0) * 15,
  });

  return (
    <BaseEdge
      path={edgePath}
      {...props}
      labels={
        data?.mid
          ? [
              {
                label: data.mid,
                transform: `translate(-50% , -50%) translate(${labelX}px, ${labelY - 10}px)`,
              },
            ]
          : []
      }
    />
  );
};

export default LoopingEdge;
