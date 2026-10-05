import { colorForSeed, useViewerConfig } from "@r4pm/components";
import type { ChartProps } from "../types";

/** A colour per name, once the scope is bound. */
export type ColorOfName = (name: string) => string;
/** A click on a mark, by the name that mark carries. */
export type SelectName = (name: string, point: unknown) => void;

/** The rows of a chart and how to read them, with colour already resolved. */
export type Drawn = Pick<ChartProps, "rows" | "x" | "y" | "series"> & {
  colorOf?: ColorOfName;
};

/**
 * A chart's props with colour and selection resolved the way every r4pm
 * viewer does: the chart's own prop, else the ambient `ViewerConfig`, else
 * the hash. Both come back bound to the chart's scope, which is all the
 * traces need.
 */
export const useChart = ({
  rows,
  x,
  y,
  series,
  colorScope,
  colorOf,
  onSelect,
}: ChartProps): Drawn & { onSelect?: SelectName } => {
  const config = useViewerConfig({ colorOf, onSelect });
  return {
    rows,
    x,
    y,
    series,
    ...(colorScope && {
      colorOf: (name: string) =>
        config.colorOf?.(colorScope, name) ?? colorForSeed(name),
    }),
    ...(config.onSelect && {
      onSelect: (name: string, point: unknown) =>
        config.onSelect?.({ scope: colorScope ?? x, key: name, data: point }),
    }),
  };
};
