import type { Core } from "cytoscape";
import type React from "react";
import { type ComponentProps, useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
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
        // Typography
        "font-size": 13,
        "font-family": "system-ui, -apple-system, sans-serif",
        "font-weight": 500,
        color: "#1a1a1a",

        // Shape & size
        shape: "data(shape)",
        width: "data(width)",
        height: "data(height)",

        // Fill
        "background-color": "data(color)",

        // Default border — subtle
        "border-width": 1.5,
        "border-color": "rgba(0,0,0,0.15)",
        "border-style": "solid",

        // Label inside node
        label: "data(label)",
        "text-valign": "data(label_pos)",
        "text-halign": "center",
        "text-wrap": "wrap",
        "text-max-width": "data(width)",

        // Breathing room between text and node edge
        "padding": 8,
      },
    },
    {
      // Nodes whose label sits above or below get a background pill so the
      // text is legible even when an edge runs behind it.
      selector: "node[?label][label_pos != 'center']",
      css: {
        "text-background-opacity": 1,
        "text-background-color": "#ffffff",
        "text-background-shape": "roundrectangle",
        "text-background-padding": "3px",
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
    // Hover feedback
    {
      selector: "node:hover",
      css: {
        "border-width": 2.5,
        "border-color": "rgba(0,0,0,0.4)",
      },
    },
  ] as any;

  const edgeStyles: cytoscape.StylesheetCSS[] = [
    {
      selector: "edge",
      css: {
        // Line
        width: 1.5,
        "line-color": "data(color)",
        "line-opacity": 0.85,
        "curve-style": "bezier",

        // Default arrow
        "target-arrow-shape": "triangle",
        "target-arrow-color": "data(color)",
        "source-arrow-color": "data(color)",
        "arrow-scale": 1.2,

        // Label typography
        "font-size": 11,
        "font-family": "system-ui, -apple-system, sans-serif",
        color: "#ffffff",
        "text-rotation": "autorotate",

        // Label pill — use the edge color as background so it blends in
        "text-background-opacity": 1,
        "text-background-shape": "roundrectangle",
        "text-background-padding": "3px",
        "text-background-color": "data(color)",
      },
    },
    {
      selector: "edge[label]",
      css: {
        label: "data(label)",
      },
    },
    {
      selector: "edge[start_label]",
      css: {
        "source-label": "data(start_label)",
        "source-text-rotation": "autorotate",
        "source-text-offset": 24,
        "source-text-background-opacity": 1,
        "source-text-background-shape": "roundrectangle",
        "source-text-background-padding": "3px",
        "source-text-background-color": "data(color)",
      },
    },
    {
      selector: "edge[end_label]",
      css: {
        "target-label": "data(end_label)",
        "target-text-rotation": "autorotate",
        "target-text-offset": 24,
        "target-text-background-opacity": 1,
        "target-text-background-shape": "roundrectangle",
        "target-text-background-padding": "3px",
        "target-text-background-color": "data(color)",
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
    // Hover feedback
    {
      selector: "edge:hover",
      css: {
        width: 2.5,
        "line-opacity": 1,
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
