import { type ReactNode, useEffect, useMemo, useRef } from "react";
import useEntityClick, {
  type CytoscapeClickEntity,
} from "../hooks/useEntityClick";

import { useFloating, flip, shift, offset, arrow } from "@floating-ui/react";
import { Paper } from "@mantine/core";

const FloatingAnnotation: React.FC<{
  trigger?: "leftClick" | "rightClick";
  children: (entity: CytoscapeClickEntity) => ReactNode;
}> = ({ trigger = "leftClick", children }) => {
  const { entity, container } = useEntityClick({ trigger });

  const arrowRef = useRef(null);

  const virtualRef = useMemo(() => {
    const containerRect = container.current?.getBoundingClientRect();

    if (!entity || !containerRect) return;
    if (entity.type === "node") {
      const b = entity.boundingBox;
      const width = b.x2 - b.x1;
      const height = b.y2 - b.y1;
      const top = containerRect.top + b.y1;
      const left = containerRect.left + b.x1;
      return {
        getBoundingClientRect: () =>
          ({
            x: left,
            y: top,
            width,
            height,
            top,
            left,
            right: left + width,
            bottom: top + height,
          }) as DOMRect,
      };
    }
    const m = entity.midpoint;
    const x = containerRect.left + m.x;
    const y = containerRect.top + m.y;
    return {
      getBoundingClientRect: () =>
        ({
          x,
          y,
          width: 0,
          height: 0,
          top: y,
          left: x,
          right: x,
          bottom: y,
        }) as DOMRect,
    };
  }, [entity, container]);

  const { x, y, refs, strategy } = useFloating({
    placement: "right",
    strategy: "fixed",
    middleware: [
      flip(),
      offset(10),
      shift({ padding: 8 }),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  useEffect(() => {
    refs.setReference(virtualRef as any);
  }, [virtualRef, refs]);

  const child = useMemo(
    () => (entity ? children(entity) : undefined),
    [entity, children],
  );

  if (!entity || !virtualRef || child == null) return null;

  return (
    <Paper
      ref={refs.setFloating}
      shadow="md"
      radius="md"
      p="md"
      withBorder
      style={{
        position: strategy,
        top: y ?? 0,
        left: x ?? 0,
        width: "min(90vw, 400px)",
        height: "min(80vh, 300px)",
        overflow: "auto",
        zIndex: 9999,
      }}
    >
      {child}
    </Paper>
  );
};

export default FloatingAnnotation;
