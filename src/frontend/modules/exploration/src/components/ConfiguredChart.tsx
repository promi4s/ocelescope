import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import type {
  OcelQueryBody,
  OcelSchemaResponse,
} from "@ocelescope/api-querying";
import { useOcelQuery } from "@ocelescope/api-querying";
import { EChartCard, useChartInteractions } from "@ocelescope/charts";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { queryErrorMessage } from "../lib/queryError";
import {
  getChartInfo,
  getChartSubtitle,
  validateChartSpec,
} from "../model/chartRegistry";
import {
  buildChartRenderModel,
  compileChartQuery,
} from "../model/chartRuntime";
import type { ChartSelection, ChartSpec } from "../model/chartSpec";
import { ChartDrillDown } from "./ChartDrillDown";

interface ConfiguredChartProps {
  ocelId: string;
  schema: OcelSchemaResponse;
  spec: ChartSpec;
  onEdit: () => void;
  onRemove: () => void;
}

const DISABLED_QUERY: OcelQueryBody = {
  source: "events",
  fields: ["ocel:eid"],
  limit: 1,
};

export function ConfiguredChart({
  ocelId,
  schema,
  spec,
  onEdit,
  onRemove,
}: ConfiguredChartProps) {
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const interactions = useChartInteractions();
  const validationErrors = useMemo(
    () => validateChartSpec(spec, schema),
    [schema, spec],
  );
  const compilation = useMemo(() => {
    if (validationErrors.length) return { query: null, error: null };
    try {
      return { query: compileChartQuery(spec), error: null };
    } catch (error) {
      return { query: null, error: queryErrorMessage(error) };
    }
  }, [spec, validationErrors.length]);
  const compiled = compilation.query;
  const result = useOcelQuery(ocelId, compiled ?? DISABLED_QUERY, undefined, {
    query: {
      enabled: compiled != null,
    },
  });
  const rendering = useMemo(() => {
    if (!result.data || !compiled) return { model: null, error: null };
    try {
      return {
        model: buildChartRenderModel(spec, result.data),
        error: null,
      };
    } catch (error) {
      return { model: null, error: queryErrorMessage(error) };
    }
  }, [compiled, result.data, spec]);
  const model = rendering.model;

  useEffect(() => {
    setSelection(null);
    interactions.resetInteractions();
  }, [spec.id, spec.chart, spec.query]);

  const error =
    validationErrors[0] ??
    compilation.error ??
    (result.error && !result.data ? queryErrorMessage(result.error) : null) ??
    rendering.error;
  const chartType = spec.chart.type;
  const height =
    chartType === "kpi" ? 180 : spec.layout.height === "large" ? 520 : 320;
  const actions = (
    <>
      <Tooltip label="Edit visualization">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Edit visualization"
          onClick={onEdit}
        >
          <PencilIcon size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Remove visualization">
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          aria-label="Remove visualization"
          onClick={onRemove}
        >
          <Trash2Icon size={14} />
        </ActionIcon>
      </Tooltip>
    </>
  );

  return (
    <Stack gap="sm">
      <EChartCard
        title={spec.title || "Untitled visualization"}
        subtitle={getChartSubtitle(spec)}
        info={getChartInfo(spec)}
        filename={spec.title || spec.chart.type}
        option={model?.option ?? null}
        loading={result.isPending && compiled != null}
        error={error}
        empty={model?.empty ?? false}
        emptyMessage="No data matches this visualization."
        height={height}
        actions={actions}
        note={
          model?.note ? (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {model.note}
              </Text>
              {result.data?.stats.truncated && (
                <Text size="xs" c="orange">
                  Result limited to{" "}
                  {result.data.stats.returned_rows.toLocaleString("en-US")}
                </Text>
              )}
            </Group>
          ) : undefined
        }
        zoom={
          chartType === "histogram" ||
          chartType === "line" ||
          chartType === "area"
            ? { axis: "x", slider: true, mouse: true }
            : undefined
        }
        viewport={interactions.viewport}
        onViewportChange={interactions.onViewportChange}
        onPointClick={
          spec.interaction.drilldown && model
            ? (point) => setSelection(model.selectionForPoint(point))
            : undefined
        }
      />

      {selection && (
        <ChartDrillDown
          ocelId={ocelId}
          schema={schema}
          spec={spec}
          selection={selection}
          onClose={() => setSelection(null)}
        />
      )}
    </Stack>
  );
}
