import {
  Edge,
  EdgeProps,
  getStraightPath,
  useInternalNode,
} from "@xyflow/react";
import { getEdgeParams } from "@/components/Graph/util/getEdgeParams";
import BaseEdge from "./BaseEdge";

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

const FloatingEdge = ({
  data,
  source,
  target,
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
      <BaseEdge
        path={edgePath}
        {...props}
        labels={
          data?.mid
            ? [
                {
                  transform: `translate(-50% , -50%) translate(${labelX}px, ${labelY}px) rotate(${angle}deg)`,
                  label: data.mid,
                },
              ]
            : []
        }
      />
    </>
  );
};

export default FloatingEdge;
