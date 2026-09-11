import { Center, Skeleton, Text } from "@mantine/core";
import EChartsReactCore from "echarts-for-react/lib/core";
import { memo, useContext, useEffect, useMemo, useRef } from "react";
import { ChartSlotContext } from "./ChartCard";
import { cartesianOption } from "./internal/cartesian";
import type { ChartEventMap, ClickParams } from "./internal/engine";
import { echarts, exportImage } from "./internal/engine";
import {
  enhanceChartOption,
  useEChartInteractions,
} from "./internal/interactions";
import { pieOption } from "./internal/pie";
import { sunburstOption } from "./internal/sunburst";
import { useChartTheme } from "./internal/theme";
import { timelineOption } from "./internal/timeline";
import type { AxisInteractions, ChartProps } from "./types";

/** The public component. Chart types differ only in their data-to-marks builder. */
export const Chart = memo(function Chart(props: ChartProps) {
  const theme = useChartTheme();
  const built = useMemo(() => {
    switch (props.type) {
      case "bar":
      case "line":
      case "scatter":
        return cartesianOption(props, theme, props.type);
      case "pie":
        return pieOption(props, theme);
      case "sunburst":
        return sunburstOption(props, theme);
      case "timeline":
        return timelineOption(props, theme);
    }
  }, [props, theme]);
  const { option, select: onClickParams } = built;
  const {
    onSelect,
    height = "100%",
    loading = false,
    emptyMessage = "No data",
  } = props;
  const empty = props.empty ?? props.rows.length === 0;
  const {
    zoom,
    brush,
    viewport,
    onViewportChange,
    onSelection,
  }: AxisInteractions =
    props.type === "pie" || props.type === "sunburst" ? {} : props;
  const chartRef = useRef<EChartsReactCore | null>(null);
  const slot = useContext(ChartSlotContext);

  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const mapRef = useRef(onClickParams);
  mapRef.current = onClickParams;

  const events = useMemo<ChartEventMap>(() => {
    if (!onSelect) return {} as ChartEventMap;
    return {
      click: (...args: unknown[]) => {
        const params = args[0] as ClickParams;
        const selection = mapRef.current?.(params);
        if (selection) selectRef.current?.(selection);
      },
    };
  }, [onSelect]);

  const interactions = useEChartInteractions({
    chartRef,
    zoom,
    brush,
    viewport,
    onViewportChange,
    onSelection,
    onEvents: events,
  });

  const enhanced = useMemo(
    () =>
      enhanceChartOption(option, {
        ...(zoom ? { zoom } : {}),
        ...(brush ? { brush } : {}),
        viewport: interactions.viewport,
      }),
    [option, zoom, brush, interactions.viewport],
  );

  // Hand the instance to an enclosing ChartCard, if there is one.
  const { canReset, reset } = interactions;
  useEffect(() => {
    if (!slot) return;
    const instance = chartRef.current?.getEchartsInstance();
    slot.register(
      instance
        ? {
            exportImage: (format, filename, background) =>
              exportImage(instance, format, filename, background),
          }
        : null,
    );
    return () => slot.register(null);
  });
  useEffect(() => {
    slot?.setResettable(!loading && !empty && canReset ? reset : null);
    return () => slot?.setResettable(null);
  }, [slot, canReset, reset, loading, empty]);

  if (loading) return <Skeleton height={height} radius="sm" />;

  if (empty) {
    return (
      <Center h={height}>
        <Text c="dimmed" size="sm" ta="center">
          {emptyMessage}
        </Text>
      </Center>
    );
  }

  return (
    <EChartsReactCore
      ref={chartRef}
      echarts={echarts}
      option={enhanced}
      notMerge
      lazyUpdate
      opts={{ renderer: "svg" }}
      style={{ width: "100%", height }}
      onEvents={interactions.events}
    />
  );
});
