// components/Cytoscape/CytoscapeGraph.tsx
import React, { ComponentProps, useRef } from "react";
import cytoscape from "cytoscape";
import CytoscapeComponent from "react-cytoscapejs";
import elk from "cytoscape-elk";
import { Core } from "cytoscape";
import { CytoscapeContext } from "./CytoscapeContext";

cytoscape.use(elk);

const CytoscapeGraph: React.FC<
  ComponentProps<typeof CytoscapeComponent> & { children?: React.ReactNode }
> = ({ children, ...props }) => {
  const cytoscapeRef = useRef<Core | null>(null);
  return (
    <CytoscapeContext.Provider value={{ cy: cytoscapeRef }}>
      <CytoscapeComponent
        style={{ width: "100%", height: "100%" }}
        cy={(cy) => (cytoscapeRef.current = cy)}
        {...props}
      />
      {children}
    </CytoscapeContext.Provider>
  );
};

export default CytoscapeGraph;
