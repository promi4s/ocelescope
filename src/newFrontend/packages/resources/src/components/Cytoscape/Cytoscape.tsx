import type React from "react";
import { type ComponentProps, useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core } from "cytoscape";
import { CytoscapeContext } from "./CytoscapeContext";

export type CytoscapeGraphProps = ComponentProps<typeof CytoscapeComponent> & {
  children?: React.ReactNode;
};

const CytoscapeGraph: React.FC<CytoscapeGraphProps> = ({
  children,
  ...props
}) => {
  const cytoscapeRef = useRef<Core | null>(null);

  useEffect(() => {
    const cy = cytoscapeRef.current;
    if (!cy) return;

    const handleResize = () => {
      cy.fit();
    };

    cy.on("resize", handleResize);

    return () => {
      cy.removeListener("resize", handleResize);
    };
  }, []);

  const nodeStyles: cytoscape.StylesheetCSS[] = [
    {
      selector: "node",
      css: {
        "font-size": 14,
        shape: "data(shape)",
        label: "data(label)",
        "text-valign": "data(label_pos)",
        "text-halign": "center",
        width: "data(width)",
        height: "data(height)",
        "background-color": "data(color)",
      },
    },
    {
      selector: "node[border_color]",
      css: {
        "border-width": 2,
        "border-color": "data(border_color)",
        "border-style": "solid",
      },
    },
  ] as any;

  const edgeStyles: cytoscape.StylesheetCSS[] = [
    {
      selector: "edge",
      css: {
        "line-color": "data(color)",
        "target-arrow-color": "data(color)",
        "source-arrow-color": "data(color)",
        "arrow-scale": 1.5,
        "curve-style": "bezier",
        "font-size": 12,
        "text-background-opacity": 1,
        "text-background-shape": "roundrectangle",
        "text-background-padding": "3px",
        "text-background-color": "#888",
      },
    },
    {
      selector: "edge[color]",
      css: {
        "text-background-color": "data(color)",
      },
    },
    {
      selector: "edge[label]",
      css: {
        label: "data(label)",
        "text-rotation": "autorotate",
      },
    },
    {
      selector: "edge[start_label]",
      css: {
        "source-label": "data(start_label)",
        "source-text-rotation": "autorotate",
        "source-text-offset": 20,
      },
    },
    {
      selector: "edge[end_label]",
      css: {
        "target-label": "data(end_label)",
        "target-text-rotation": "autorotate",
        "target-text-offset": 20,
      },
    },
    {
      selector: "edge[start_arrow]",
      css: {
        "source-arrow-shape": "data(start_arrow)",
      },
    },
    {
      selector: "edge[end_arrow]",
      css: {
        "target-arrow-shape": "data(end_arrow)",
      },
    },
  ] as any;

  return (
    <CytoscapeContext.Provider value={{ cy: cytoscapeRef }}>
      <CytoscapeComponent
        style={{ width: "100%", height: "100%" }}
        stylesheet={[...nodeStyles, ...edgeStyles]}
        cy={(cy) => {
          cytoscapeRef.current = cy;
        }}
        {...props}
      />
      {children}
    </CytoscapeContext.Provider>
  );
};

export default CytoscapeGraph;
