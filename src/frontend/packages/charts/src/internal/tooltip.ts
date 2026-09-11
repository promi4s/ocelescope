import type { ChartTheme, Row, TooltipSpec, ValueFormatter } from "../types";
import { rowTotal, toNumber } from "./data";
import { defaultValueFormat } from "./theme";

/**
 * One tooltip implementation for the whole package. Every builder used to
 * hand-roll an HTML formatter with its own escaping and percentage maths, which
 * is how three near-identical 40-line formatters ended up in `configurations/`.
 */

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The subset of the ECharts callback payload the formatters rely on. */
interface TooltipParam {
  marker?: string;
  seriesName?: string;
  seriesIndex?: number;
  name?: string;
  axisValueLabel?: string;
  value?: unknown;
  data?: unknown;
  encode?: { y?: number[]; x?: number[] };
  dimensionNames?: string[];
  percent?: number;
}

const asRow = (data: unknown): Row | undefined =>
  typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Row)
    : undefined;

/**
 * Reads the numeric value of one tooltip entry. Dataset-driven series hand back
 * the whole row, so the series' own column has to be picked out of it.
 */
const paramValue = (param: TooltipParam, column?: string): number => {
  const row = asRow(param.data);
  if (row && column != null && column in row) return toNumber(row[column]);
  if (Array.isArray(param.value)) {
    const last = param.value.at(-1);
    return toNumber(last as never);
  }
  return toNumber(param.value as never);
};

export interface TooltipContext {
  theme: ChartTheme;
  spec: TooltipSpec | false | undefined;
  /** Series columns, in series order, for dataset-driven charts. */
  columns?: string[];
  /** Default trigger when the spec does not say. */
  defaultTrigger?: "axis" | "item";
  valueFormat?: ValueFormatter;
}

const tooltipChrome = (theme: ChartTheme) => ({
  backgroundColor: theme.tooltipBackground,
  borderColor: theme.tooltipBorder,
  borderWidth: 1,
  textStyle: { color: theme.text, fontFamily: theme.fontFamily, fontSize: 12 },
  confine: true,
  extraCssText: "box-shadow: 0 2px 8px rgba(0,0,0,.12); max-width: 320px;",
});

export const buildTooltip = ({
  theme,
  spec,
  columns,
  defaultTrigger = "axis",
  valueFormat = defaultValueFormat,
}: TooltipContext) => {
  if (spec === false) return { show: false as const };

  const trigger = spec?.trigger ?? defaultTrigger;
  if (trigger === "none") return { show: false as const };

  const format = spec?.format ?? valueFormat;
  const hideZero = spec?.hideZero ?? true;
  const showPercent = spec?.showPercent ?? false;
  const showTotal = spec?.showTotal ?? false;
  const totalLabel = spec?.totalLabel ?? "Total";

  const chrome = {
    ...tooltipChrome(theme),
    trigger,
    ...(trigger === "axis" ? { axisPointer: { type: "shadow" as const } } : {}),
  };

  // A single-series item tooltip needs no custom rendering.
  if (trigger === "item" && !showPercent && !columns) {
    return {
      ...chrome,
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? format(value) : String(value ?? ""),
    };
  }

  return {
    ...chrome,
    formatter: (raw: unknown) => {
      const params = (Array.isArray(raw) ? raw : [raw]) as TooltipParam[];
      const entries = params.map((param, index) => ({
        param,
        column: columns?.[param.seriesIndex ?? index],
        value: paramValue(param, columns?.[param.seriesIndex ?? index]),
      }));
      const visible = hideZero
        ? entries.filter((entry) => entry.value !== 0)
        : entries;
      const first = visible[0] ?? entries[0];
      if (!first) return "";

      const row = asRow(first.param.data);
      const total =
        columns && row
          ? rowTotal(row, columns)
          : entries.reduce((sum, entry) => sum + entry.value, 0);
      const denominator = typeof showPercent === "number" ? showPercent : total;

      const heading = first.param.axisValueLabel ?? first.param.name ?? "";
      const lines = [`<strong>${escapeHtml(heading)}</strong>`];

      for (const { param, value } of visible) {
        const label = param.seriesName ?? param.name ?? "";
        const share =
          showPercent && denominator > 0
            ? ` (${((value / denominator) * 100).toFixed(1)}%)`
            : "";
        lines.push(
          `${param.marker ?? ""}${escapeHtml(label)}: ${escapeHtml(
            format(value),
          )}${share}`,
        );
      }

      if (showTotal && visible.length > 1) {
        lines.push(
          `<strong>${escapeHtml(totalLabel)}: ${escapeHtml(
            format(total),
          )}</strong>`,
        );
      }

      return lines.join("<br/>");
    },
  };
};
