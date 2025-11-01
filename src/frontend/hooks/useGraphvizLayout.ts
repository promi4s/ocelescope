import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementDefinition } from "cytoscape";
import type { VisualizationByType } from "@/types/resources";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { omitBy, isNil } from "lodash";

type GraphvizJSON = {
  bb?: string;
  objects?: Array<{
    name?: string;
    _gvid?: number;
    pos?: string;
    width?: string;
    height?: number | string;
    label?: string | { text?: string };
  }>;
  edges?: Array<{
    tail?: string;
    head?: string;
    pos?: string;
  }>;
};

const esc = (val: string) => {
  return val.replaceAll('"', '\\"');
};

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

const attrsToDot = (
  obj?: Record<string, string | number | boolean | undefined | null>,
) => {
  if (!obj) return "";
  const kv = Object.entries(obj)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([k, v]) =>
      typeof v === "string" ? `${k}="${esc(v)}"` : `${k}=${String(v)}`,
    );
  return kv.join(",");
};

export const toDot = (visualization: VisualizationByType<"graph">) => {
  const gAttrs = attrsToDot(
    visualization.layout_config?.graphAttrs ?? undefined,
  );
  const nAttrs = attrsToDot(
    visualization.layout_config?.nodeAttrs ?? undefined,
  );
  const eAttrs = attrsToDot(
    visualization.layout_config?.edgeAttrs ?? undefined,
  );

  const lines: string[] = [
    "digraph G {",
    `graph [${gAttrs}];`,
    `node [${nAttrs}];`,
    `edge [${eAttrs}];`,
  ];

  for (const node of visualization.nodes ?? []) {
    const id = safeId(node?.id ?? "");
    const attrs = {
      ...node.layout_attrs,
      label: node.label ? esc(node.label) : undefined,
      shape: node.shape,
      color: node.color,
      ...(node.width && { width: (node.width / 72).toFixed(4) }),
      ...(node.height && { height: (node.height / 72).toFixed(4) }),
    };

    lines.push(`"${id}" [${attrsToDot(attrs)}];`);
  }

  for (const edge of visualization.edges ?? []) {
    const attrs = {
      ...edge.layout_attrs,
      label: edge.label ? esc(edge.label) : undefined,
      color: edge.color,
    };

    lines.push(
      `"${esc(safeId(edge.source))}" -> "${esc(safeId(edge.target))}" [${attrsToDot(attrs)}];`,
    );
  }

  const ranks = (visualization.nodes ?? [])
    .filter(({ rank }) => rank != null)
    .reduce<Partial<Record<"source" | "sink" | number, string[]>>>(
      (acc, current) => {
        const key = current.rank as "sink" | "source" | number;
        (acc[key] ??= []).push(esc(safeId(current?.id ?? "")));
        return acc;
      },
      {},
    );

  lines.push(
    ...Object.entries(ranks).map(
      ([key, value]) =>
        `{ rank=${["source", "sink"].includes(key) ? key : "same"}; ${(value ?? []).join(" ")} } `,
    ),
  );

  lines.push("}");

  return lines.join("\n");
};

const parsePos = (s?: string) => {
  if (!s) return;
  const [xs, ys] = s.split(",");
  const x = parseFloat(xs);
  const y = parseFloat(ys);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
};

export const useGraphvizLayout = (
  visualization: VisualizationByType<"graph">,
) => {
  const [elements, setElements] = useState<ElementDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const dot = useMemo(
    () => toDot(visualization),
    [visualization.nodes, visualization.edges, visualization.layout_config],
  );

  useEffect(() => {
    cancelRef.current.cancelled = false;
    setError(null);

    (async () => {
      try {
        const gv = await Graphviz.load();
        const jsonStr = gv.layout(
          dot,
          "json",
          visualization.layout_config?.engine ?? "dot",
        );
        const gvJson: GraphvizJSON = JSON.parse(jsonStr);

        const nodePos: Record<
          string,
          { x: number; y: number; width?: number }
        > = {};
        gvJson.objects?.forEach((o) => {
          if (!o.name || !o.pos) return;
          const p = parsePos(o.pos);
          if (!p) return;
          nodePos[o.name] = {
            ...p,
            width: o.width ? parseFloat(o.width) * 72 : undefined,
          };
        });

        const nodes: ElementDefinition[] = (visualization.nodes ?? []).map(
          (node) => ({
            data: {
              ...omitBy(node, isNil),
              label: node.label ?? "",
              shape: node.shape !== "circle" ? node.shape : "ellipse",
              width: node.width ?? nodePos[safeId(node.id ?? "")].width,
              height: node.height ?? 30, // ✅ default
            },
            position: nodePos[safeId(node.id ?? "")] ?? { x: 0, y: 0 },
          }),
        );

        const edges: ElementDefinition[] = (visualization.edges ?? []).map(
          (edge) => ({
            data: omitBy(edge, isNil),
          }),
        );

        if (!cancelRef.current.cancelled) {
          setElements([...nodes, ...edges]);
        }
      } catch (e: any) {
        if (!cancelRef.current.cancelled) {
          setError(e?.message ?? "Graphviz layout failed.");
          setElements(null);
        }
      }
    })();

    return () => {
      cancelRef.current.cancelled = true;
    };
  }, [dot, visualization]);

  return { elements, error };
};
