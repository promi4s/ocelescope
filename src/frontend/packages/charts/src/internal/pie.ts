import type { ChartTheme, PieChartProps } from "../types";
import { sortRows, toLabel, toNumber } from "./data";
import type { BuiltChart, ClickParams, OptionBuilder } from "./engine";
import { baseOption, defaultValueFormat } from "./theme";
import { buildTooltip } from "./tooltip";

export const pieOption: OptionBuilder<PieChartProps> = (
  props: PieChartProps,
  theme: ChartTheme,
): BuiltChart => {
  const {
    rows,
    name,
    value,
    donut = false,
    showLabels = false,
    sort = "desc",
    palette,
    valueFormat = defaultValueFormat,
    tooltip,
    legend = true,
    itemColor,
    topN,
  } = props;

  const sorted = sortRows(rows, value, sort);
  const source =
    topN != null && Number.isInteger(topN) && topN > 0 && sorted.length > topN
      ? [
          ...sorted.slice(0, topN),
          {
            [name]: `Other (${sorted.length - topN})`,
            [value]: sorted
              .slice(topN)
              .reduce((sum, row) => sum + toNumber(row[value]), 0),
          },
        ]
      : sorted;

  const base = baseOption(theme, palette);

  return {
    option: {
      ...base,
      grid: undefined,
      legend: {
        ...base.legend,
        show: legend,
        orient: "vertical",
        right: 0,
        top: "middle",
      },
      tooltip: buildTooltip({
        theme,
        spec: tooltip,
        defaultTrigger: "item",
        valueFormat,
      }),
      series: [
        {
          type: "pie",
          radius: donut ? ["46%", "72%"] : "72%",
          center: [legend ? "38%" : "50%", "50%"],
          avoidLabelOverlap: true,
          minAngle: 2,
          padAngle: 1,
          itemStyle: { borderColor: theme.background, borderWidth: 1 },
          label: showLabels
            ? { show: true, color: theme.text, formatter: "{b}: {d}%" }
            : { show: false },
          emphasis: { label: { show: true, fontWeight: "bold" } },
          data: source.map((row, index) => ({
            name: toLabel(row[name]),
            value: toNumber(row[value]),
            ...(itemColor
              ? {
                  itemStyle: {
                    color:
                      itemColor(row) ??
                      (palette ?? theme.palette)[
                        index % (palette ?? theme.palette).length
                      ],
                    borderColor: theme.background,
                    borderWidth: 1,
                  },
                }
              : {}),
          })),
        },
      ],
    },
    select: (params: ClickParams) => {
      const index = params.dataIndex ?? -1;
      const row = source[index];
      if (!row) return undefined;
      const originals = sorted.includes(row) ? [row] : sorted.slice(topN);
      return {
        row: originals[0]!,
        rows: originals,
        category: toLabel(row[name]),
        value: toNumber(row[value]),
      };
    },
  };
};
