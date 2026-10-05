import { EmptyState, useViewSetting } from "@r4pm/components";
import { Flex, SegmentedControl, Text } from "@r4pm/components/ui";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { HistogramChart } from "./HistogramChart";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";
import { ScatterChart } from "./ScatterChart";
import { SunburstChart } from "./SunburstChart";
import type { ChartType, SqlChartProps, Table } from "./types";

/**
 * A query's result, drawn.
 *
 * It reads the result's own column types to decide what goes across and what
 * goes up, and hands the rows to one of the charts; colours and selection
 * reach them from the ambient `ViewerConfig`, or from the props given here.
 */
export const SqlChart = ({
  data,
  type: initialType = "bar",
  types = [],
  x,
  xEnd,
  y,
  series,
  path,
  stacked = false,
  horizontal = false,
  yAxes = "shared",
  colorScope,
  title,
  height = "100%",
  colorOf,
  onSelect,
}: SqlChartProps) => {
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
    colorScope,
    colorOf,
    onSelect,
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
        // Room on the right for an enclosing export frame's menu.
        <Flex gap="2" mb="2" pr="8" align="center" wrap="wrap">
          {title && (
            <Text size="2" weight="bold" truncate>
              {title}
            </Text>
          )}
          {types.length > 1 && (
            <SegmentedControl.Root
              data-export-ignore
              size="1"
              radius="full"
              value={type}
              onValueChange={(value) => setType(value as ChartType)}
            >
              {types.map((option) => (
                <SegmentedControl.Item key={option} value={option}>
                  {option[0]?.toUpperCase() + option.slice(1)}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
          )}
        </Flex>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {data.rows.length === 0 ? (
          <EmptyState
            title="No data"
            description="The query returned no rows."
          />
        ) : type === "bar" ? (
          <BarChart {...chart} stacked={stacked} horizontal={horizontal} />
        ) : type === "histogram" && xEnd ? (
          <HistogramChart {...chart} xEnd={xEnd} />
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
  result: Table,
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
