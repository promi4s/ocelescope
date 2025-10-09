import { useEffect, useState } from "react";
import { useCytoscapeContext } from "../CytoscapeContext";

type TriggerType = "hover" | "rightClick" | "leftClick" | "doubleClick";

type Entity =
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

const EntityAnnotation: React.FC<{
  trigger: TriggerType;
  children?: (props: {
    entity?: Entity;
    resetEntity: () => void;
  }) => React.ReactNode;
}> = ({ trigger, children }) => {
  const context = useCytoscapeContext();
  const [entity, setEntity] = useState<Entity | undefined>();

  useEffect(() => {
    const cytoscape = context?.cy.current;
    if (!cytoscape) return;

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

    const handleViewChange = () => {
      setEntity((prev) => {
        if (!prev) return prev;
        const ele = cytoscape.getElementById(prev.id);
        if (!ele || ele.empty()) return prev;

        if (prev.type === "node") {
          return { ...prev, boundingBox: ele.renderedBoundingBox() };
        } else {
          const midpoint = ele.renderedMidpoint();
          return { ...prev, midpoint };
        }
      });
    };

    const handleClickOutside = (e: cytoscape.EventObject) => {
      if (e.target === cytoscape) setEntity(undefined);
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

  return <>{children?.({ entity, resetEntity: () => setEntity(undefined) })}</>;
};

export default EntityAnnotation;
