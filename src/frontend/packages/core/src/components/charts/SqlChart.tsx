import { Group, SegmentedControl, Text } from "@mantine/core";
import type { SqlQueryResult } from "@ocelescope/api-base";
import { EmptyState, useViewerConfig, useViewSetting } from "@r4pm/components";
import type { ChartType, SqlChartProps } from ".";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";
import { ScatterChart } from "./ScatterChart";
import { SunburstChart } from "./SunburstChart";

/**
 * A query's result, drawn.
 *
 * This is the r4pm viewer: it reads the result's own column types to decide
 * what goes across and what goes up, takes colours and selection from the
 * ambient `ViewerConfig`, and hands the rows to one of the charts.
 */
export const SqlChart = ({
  data,
  type: initialType = "bar",
  types = [],
  x,
  y,
  series,
  path,
  stacked = false,
  horizontal = false,
  yAxes = "shared",
  colorScope,
  title,
  height = "100%",
  ...config
}: SqlChartProps) => {
  const { colorOf, onSelect } = useViewerConfig(config);
  // Keyed by title so two charts under one ViewStateProvider keep their own
  // choice rather than switching together.
  const [type, setType] = useViewSetting<ChartType>(
    `chartType:${title ?? ""}`,
    initialType,
  );

  const { category, measures } = columns(data, { x, y, series });
  const chart = {
    rows: data.rows,
    x: category,
    y: measures,
    series,
    ...(colorScope && {
      colorOf: (name: string) => colorOf?.(colorScope, name) ?? "#888888",
    }),
    onSelect: (name: string, point: unknown) =>
      onSelect?.({ scope: colorScope ?? category, key: name, data: point }),
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height,
      }}
    >
      {(title || types.length > 1) && (
        <Group gap="xs" mb="xs" pr={48} justify="flex-start" wrap="wrap">
          {title && (
            <Text size="sm" fw={600} truncate>
              {title}
            </Text>
          )}
          {types.length > 1 && (
            <SegmentedControl
              data-export-ignore
              size="xs"
              radius="xl"
              value={type}
              onChange={(value) => setType(value as ChartType)}
              data={types.map((option) => ({
                value: option,
                label: option[0]?.toUpperCase() + option.slice(1),
              }))}
            />
          )}
        </Group>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {data.rows.length === 0 ? (
          <EmptyState
            title="No data"
            description="The query returned no rows."
          />
        ) : type === "bar" ? (
          <BarChart {...chart} stacked={stacked} horizontal={horizontal} />
        ) : type === "line" ? (
          <LineChart {...chart} yAxes={yAxes} />
        ) : type === "area" ? (
          <AreaChart {...chart} />
        ) : type === "scatter" ? (
          <ScatterChart {...chart} />
        ) : type === "pie" ? (
          <PieChart {...chart} />
        ) : (
          <SunburstChart {...chart} path={path} />
        )}
      </div>
    </div>
  );
};

const NUMERIC = /INT|DEC|DOUBLE|FLOAT|REAL|NUMERIC|HUGEINT/;

/** What to draw: the first non-numeric column across, the numbers up. */
const columns = (
  result: SqlQueryResult,
  { x, y, series }: Pick<SqlChartProps, "x" | "y" | "series">,
) => {
  const numeric = (name: string) =>
    NUMERIC.test(
      result.columns
        .find((column) => column.name === name)
        ?.type.toUpperCase() ?? "",
    );
  const category =
    x ??
    result.columns.find((column) => !numeric(column.name))?.name ??
    result.columns[0]?.name ??
    "";
  const named = y == null ? [] : Array.isArray(y) ? y : [y];
  const measures = (
    named.length > 0
      ? named
      : result.columns
          .map((column) => column.name)
          .filter((name) => numeric(name) && name !== category)
  ).filter((name) => name !== series);

  return { category, measures };
};
