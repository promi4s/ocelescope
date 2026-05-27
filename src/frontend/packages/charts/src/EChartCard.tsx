import { ActionIcon, Modal } from "@mantine/core";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { DownloadIcon, Maximize2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { ChartCard } from "./ChartCard";
import type ReactEChartsType from "echarts-for-react";

export interface EChartCardProps {
  title: string;
  subtitle?: string;
  info?: string;
  filename?: string;

  controls?: React.ReactNode;
  settings?: React.ReactNode;
  actions?: React.ReactNode;
  note?: React.ReactNode;

  compact?: boolean;
  height?: number | string;

  expandable?: boolean;
  expandedHeight?: number | string;

  option: EChartsOption;
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
}: EChartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const chartRef = useRef<ReactEChartsType>(null);

  const handleDownload = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !filename) return;

    const url = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fff",
    });

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}.png`;
    anchor.click();
  };

  const extraActions = (
    <>
      {actions}

      {expandable && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Open larger chart"
          onClick={() => setExpanded(true)}
        >
          <Maximize2Icon size={14} />
        </ActionIcon>
      )}

      {filename && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Download as PNG"
          onClick={handleDownload}
        >
          <DownloadIcon size={14} />
        </ActionIcon>
      )}
    </>
  );

  return (
    <>
      <ChartCard
        title={title}
        subtitle={subtitle}
        info={info}
        controls={controls}
        settings={settings}
        actions={extraActions}
        note={note}
        compact={compact}
        height={height}
      >
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge
          lazyUpdate
          style={{ width: "100%", height: "100%" }}
        />
      </ChartCard>

      <Modal
        opened={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        size="90vw"
        centered
      >
        {subtitle && (
          <div
            style={{ marginBottom: 12, color: "var(--mantine-color-dimmed)" }}
          >
            {subtitle}
          </div>
        )}

        <ReactECharts
          option={option}
          notMerge
          lazyUpdate
          style={{ width: "100%", height: expandedHeight }}
        />
      </Modal>
    </>
  );
}
