import { useEffect, useRef, useState } from "react";
import { useCytoscapeContext } from "../CytoscapeContext";

type TriggerType = "hover" | "rightClick" | "leftClick" | "doubleClick";

export type CytoscapeClickEntity =
  | {
      type: "node";
      id: string;
      boundingBox: cytoscape.BoundingBox12;
    }
  | {
      type: "edge";
      id: string;
      midpoint: { x: number; y: number };
    };

const triggerActionToStartEvent = {
  hover: "tapdragover",
  rightClick: "cxttap",
  leftClick: "tap",
  doubleClick: "dbltap",
};

const useEntityClick = ({ trigger }: { trigger: TriggerType }) => {
  const context = useCytoscapeContext();
  const [entity, setEntity] = useState<CytoscapeClickEntity | undefined>();
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const cytoscape = context?.cy.current;
    const container = cytoscape?.container();

    if (!cytoscape || !container) return;
    containerRef.current = container;

    const handleEntitySelect = (event: cytoscape.EventObject) => {
      const target = event.target;
      if (target.isNode()) {
        setEntity({
          type: "node",
          id: target.id(),
          boundingBox: target.renderedBoundingBox(),
        });
      } else if (target.isEdge()) {
        const midpoint = target.renderedMidpoint();
        setEntity({
          type: "edge",
          id: target.id(),
          midpoint: { x: midpoint.x, y: midpoint.y },
        });
      }
    };

    const handleClickOutside = (e: cytoscape.EventObject) => {
      if (e.target === context?.cy.current) setEntity(undefined);
    };

    const handleViewChange = () => {
      setEntity((prev) => {
        if (!prev) return prev;
        const ele = context?.cy.current?.getElementById(prev.id);
        if (!ele || ele.empty()) return prev;

        if (prev.type === "node") {
          return { ...prev, boundingBox: ele.renderedBoundingBox() };
        }

        const midpoint = ele.renderedMidpoint();
        return { ...prev, midpoint };
      });
    };

    cytoscape.on(
      triggerActionToStartEvent[trigger],
      "node, edge",
      handleEntitySelect,
    );
    cytoscape.on("pan zoom position", handleViewChange);
    cytoscape.on("tap", handleClickOutside);

    return () => {
      cytoscape.removeListener(
        triggerActionToStartEvent[trigger],
        "node, edge",
        handleEntitySelect,
      );
      cytoscape.removeListener("pan zoom position", handleViewChange);
      cytoscape.removeListener("tap", handleClickOutside);
    };
  }, [context, trigger]);

  return {
    entity,
    container: containerRef,
    resetEntity: () => setEntity(undefined),
  };
};

export default useEntityClick;
