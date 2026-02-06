import assignUniqueColors from "@/util/colors";
import { BarChart } from "@mantine/charts";
import { Paper, Text } from "@mantine/core";
import { memo, useMemo } from "react";

type BarChartSelectProps = {
  values: {
    value: number;
    key: string;
  }[];
  selected: string[];
  onSelect: (selectedValue: string) => void;
};

const BarChartSelect: React.FC<BarChartSelectProps> = memo(
  ({ values, selected, onSelect }) => {
    const colorMap = useMemo(() => {
      return assignUniqueColors(
        Array.from(new Set(values.map(({ key }) => key))),
      );
    }, [values]);

    return (
      <BarChart
        h={30 * values.length}
        data={values.map(({ value, key }) => ({
          key,
          value,
          color: selected.includes(key)
            ? colorMap[key]
            : "rgba(128, 128, 128, 0.3)",
        }))}
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
            onSelect(activeLabel);
          },
        }}
      />
    );
  },
);

export default BarChartSelect;
