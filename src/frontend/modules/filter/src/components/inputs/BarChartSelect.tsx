import { BarChart } from "@mantine/charts";
import { Paper, Text } from "@mantine/core";
import { memo, useMemo } from "react";
import assignUniqueColors from "../../util/color";

type BarChartSelectProps = {
  values: {
    value: number;
    key: string;
  }[];
  selected: string[];
  onSelect: (selectedValue: string) => void;
};

export const BAR_HEIGHT = 30;

const BarChartSelect: React.FC<BarChartSelectProps> = memo(
  ({ values, selected, onSelect }) => {
    const colorMap = useMemo(() => {
      return assignUniqueColors(
        Array.from(new Set(values.map(({ key }) => key))),
      );
    }, [values]);

    const data = useMemo(
      () =>
        [...values]
          .sort((a, b) => b.value - a.value)
          .map(({ value, key }) => ({
            key,
            value,
            color: selected.includes(key)
              ? colorMap[key]
              : "rgba(128, 128, 128, 0.3)",
          })),
      [values, selected, colorMap],
    );

    return (
      <BarChart
        h={BAR_HEIGHT * values.length}
        data={data}
        minBarSize={30}
        tooltipProps={{
          content: ({ label }) => (
            <Paper px="md" py="sm" withBorder shadow="md" radius="md">
              <Text>{label}</Text>
            </Paper>
          ),
        }}
        dataKey="key"
        orientation="vertical"
        yAxisProps={{ width: 130 }}
        series={[{ name: "value", color: "gray.6" }]}
        gridAxis="none"
        barChartProps={{
          onClick: ({ activeLabel }) => {
            if (!activeLabel) return;
            onSelect(String(activeLabel));
          },
        }}
      />
    );
  },
);

export default BarChartSelect;
