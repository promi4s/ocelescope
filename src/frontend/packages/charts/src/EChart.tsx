import { ActionIcon, Group, Popover, Stack, Text } from "@mantine/core";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { DownloadIcon, InfoIcon } from "lucide-react";
import { useRef } from "react";

export interface EChartProps {
  option: EChartsOption;
  title?: string;
  /** Markdown-free description shown in the info popover. */
  info?: string;
  /** Parameter controls rendered between the header and the chart. */
  controls?: React.ReactNode;
  /** Informational note rendered below the chart (e.g. excluded value counts). */
  note?: React.ReactNode;
  height?: number | string;
  /** Base filename (no extension) for the PNG export. */
  filename?: string;
  style?: React.CSSProperties;
}

export const EChart: React.FC<EChartProps> = ({
  option,
  title,
  info,
  controls,
  note,
  height = 320,
  filename = "chart",
  style,
}) => {
  const chartRef = useRef<ReactECharts>(null);

  const handleExport = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fff",
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  };

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="center" wrap="nowrap">
        {title ? (
          <Text fw={500} size="sm">
            {title}
          </Text>
        ) : (
          <span />
        )}
        <Group gap={2} wrap="nowrap">
          {info && (
            <Popover width={300} withArrow shadow="sm" position="bottom-end">
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  title="About this chart"
                >
                  <InfoIcon size={14} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">{info}</Text>
              </Popover.Dropdown>
            </Popover>
          )}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={handleExport}
            title="Export as PNG"
          >
            <DownloadIcon size={14} />
          </ActionIcon>
        </Group>
      </Group>
      {controls}
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          ...style,
        }}
      />
      {note}
    </Stack>
  );
};
