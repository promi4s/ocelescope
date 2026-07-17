import {
  ActionIcon,
  Alert,
  Center,
  Menu,
  Modal,
  Skeleton,
  Text,
  Tooltip,
} from "@mantine/core";
import type { EChartsOption } from "echarts";
import type ReactEChartsType from "echarts-for-react";
import {
  CircleAlertIcon,
  DownloadIcon,
  FileImageIcon,
  FileType2Icon,
  Maximize2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";

import { ChartCanvas } from "./ChartCanvas";
import { ChartCard } from "./ChartCard";
import { enhanceChartOption } from "./chartOption";
import type {
  BrushConfig,
  ChartEventMap,
  ChartPoint,
  ChartViewport,
  ZoomConfig,
} from "./types";
import { useChartExport } from "./useChartExport";
import { useEChartInteractions } from "./useEChartInteractions";

export interface EChartCardProps {
  title: string;
  subtitle?: string;
  info?: ReactNode;
  filename?: string;
  controls?: ReactNode;
  settings?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  compact?: boolean;
  height?: number | string;
  expandable?: boolean;
  expandedHeight?: number | string;

  option: EChartsOption | null;
  loading?: boolean;
  error?: ReactNode;
  empty?: boolean;
  emptyMessage?: ReactNode;

  zoom?: ZoomConfig;
  brush?: BrushConfig;
  viewport?: ChartViewport | null;
  onViewportChange?: (viewport: ChartViewport | null) => void;
  onSelection?: (selection: ChartViewport | null) => void;
  onPointClick?: (point: ChartPoint) => void;
  onEvents?: ChartEventMap;
}

interface ChartActionsProps {
  custom?: ReactNode;
  ready: boolean;
  expandable: boolean;
  filename?: string;
  canReset: boolean;
  onReset: () => void;
  onExpand: () => void;
  onExport: (format: "png" | "svg") => void;
}

function ChartActions({
  custom,
  ready,
  expandable,
  filename,
  canReset,
  onReset,
  onExpand,
  onExport,
}: ChartActionsProps) {
  return (
    <>
      {custom}
      {canReset && (
        <Tooltip label="Reset view">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onReset}
            aria-label="Reset chart view"
          >
            <RotateCcwIcon size={14} />
          </ActionIcon>
        </Tooltip>
      )}
      {expandable && ready && (
        <Tooltip label="Open larger chart">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Open larger chart"
            onClick={onExpand}
          >
            <Maximize2Icon size={14} />
          </ActionIcon>
        </Tooltip>
      )}
      {filename && ready && (
        <Menu position="bottom-end" shadow="md">
          <Menu.Target>
            <Tooltip label="Download chart">
              <ActionIcon
                variant="light"
                color="blue"
                size="md"
                aria-label="Download chart"
              >
                <DownloadIcon size={16} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<FileImageIcon size={14} />}
              onClick={() => onExport("png")}
            >
              PNG image
            </Menu.Item>
            <Menu.Item
              leftSection={<FileType2Icon size={14} />}
              onClick={() => onExport("svg")}
            >
              SVG image
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </>
  );
}

function ChartContent({
  chartRef,
  option,
  events,
  loading,
  error,
  empty,
  emptyMessage,
}: {
  chartRef: React.RefObject<ReactEChartsType | null>;
  option: EChartsOption | null;
  events: ChartEventMap;
  loading: boolean;
  error?: ReactNode;
  empty: boolean;
  emptyMessage: ReactNode;
}) {
  if (loading) return <Skeleton h="100%" />;
  if (error) {
    return (
      <Center h="100%">
        <Alert
          icon={<CircleAlertIcon size={16} />}
          color="red"
          title="Unable to load chart"
          maw={520}
        >
          {error}
        </Alert>
      </Center>
    );
  }
  if (empty || !option) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm" ta="center">
          {emptyMessage}
        </Text>
      </Center>
    );
  }
  return <ChartCanvas chartRef={chartRef} option={option} events={events} />;
}

export function EChartCard({
  title,
  subtitle,
  info,
  filename = "chart",
  controls,
  settings,
  actions,
  note,
  compact,
  height,
  expandable = true,
  expandedHeight = 620,
  option,
  loading = false,
  error,
  empty = false,
  emptyMessage = "No data available for this chart.",
  zoom,
  brush,
  viewport,
  onViewportChange,
  onSelection,
  onPointClick,
  onEvents,
}: EChartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const chartRef = useRef<ReactEChartsType>(null);
  const modalChartRef = useRef<ReactEChartsType>(null);
  const interaction = useEChartInteractions({
    chartRef,
    zoom,
    brush,
    viewport,
    onViewportChange,
    onSelection,
    onPointClick,
    onEvents,
  });
  const enhancedOption = useMemo(
    () =>
      option
        ? enhanceChartOption(option, {
            zoom,
            brush,
            viewport: interaction.viewport,
          })
        : null,
    [brush, interaction.viewport, option, zoom],
  );
  const exportChart = useChartExport(chartRef, filename);
  const ready = enhancedOption != null && !loading && !error && !empty;

  return (
    <>
      <ChartCard
        title={title}
        subtitle={subtitle}
        info={info}
        controls={controls}
        settings={settings}
        actions={
          <ChartActions
            custom={actions}
            ready={ready}
            expandable={expandable}
            filename={filename}
            canReset={interaction.canReset}
            onReset={interaction.reset}
            onExpand={() => setExpanded(true)}
            onExport={exportChart}
          />
        }
        note={note}
        compact={compact}
        height={height}
      >
        <ChartContent
          chartRef={chartRef}
          option={enhancedOption}
          events={interaction.events}
          loading={loading}
          error={error}
          empty={empty}
          emptyMessage={emptyMessage}
        />
      </ChartCard>

      <Modal
        opened={expanded && ready}
        onClose={() => setExpanded(false)}
        onEnterTransitionEnd={() =>
          modalChartRef.current?.getEchartsInstance()?.resize()
        }
        title={title}
        size="90vw"
        centered
      >
        {subtitle && (
          <Text c="dimmed" size="sm" mb="sm">
            {subtitle}
          </Text>
        )}
        {enhancedOption && (
          <ChartCanvas
            chartRef={modalChartRef}
            option={enhancedOption}
            events={interaction.events}
            height={expandedHeight}
          />
        )}
      </Modal>
    </>
  );
}
