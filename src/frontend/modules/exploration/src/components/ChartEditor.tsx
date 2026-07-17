import {
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import type { OcelSchemaResponse } from "@ocelescope/api-querying";
import {
  AreaChartIcon,
  BarChart3Icon,
  ChartNoAxesColumnIncreasingIcon,
  CircleAlertIcon,
  HashIcon,
  LineChartIcon,
  PieChartIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import type { TimeUnit } from "../model/analysisQuery";
import { getSourceSchema } from "../model/analysisQuery";
import { createCustomChartSpec } from "../model/chartFactory";
import {
  CHART_DEFINITIONS,
  getChartDefinition,
  validateChartSpec,
} from "../model/chartRegistry";
import type { ChartSpec, ChartType } from "../model/chartSpec";
import type {
  DimensionExpressionId,
  DimensionSelection,
  SemanticChartSelection,
} from "../model/semanticCatalog";
import {
  buildSemanticQuery,
  countMeasureForSource,
  dimensionsForChart,
  getDimensionDefinition,
  measuresForSource,
  semanticAttributes,
} from "../model/semanticCatalog";

interface ChartEditorProps {
  opened: boolean;
  schema: OcelSchemaResponse;
  initialSpec: ChartSpec | null;
  onClose: () => void;
  onSave: (spec: ChartSpec) => void;
}

const TIME_UNITS: Array<{ value: TimeUnit; label: string }> = [
  { value: "minute", label: "Minute" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const CHART_ICONS: Record<ChartType, ComponentType<{ size?: number }>> = {
  kpi: HashIcon,
  bar: BarChart3Icon,
  line: LineChartIcon,
  area: AreaChartIcon,
  pie: PieChartIcon,
  histogram: ChartNoAxesColumnIncreasingIcon,
};

const sectionLabel = (children: string) => (
  <Text size="xs" fw={600} c="dimmed" tt="uppercase">
    {children}
  </Text>
);

function cloneSpec(spec: ChartSpec): ChartSpec {
  return JSON.parse(JSON.stringify(spec)) as ChartSpec;
}

function initialDimensionSelection(
  schema: OcelSchemaResponse,
  id: DimensionExpressionId,
  chartType: ChartType,
): DimensionSelection {
  const definition = getDimensionDefinition(id);
  if (definition.parameter === "time") {
    return { id, parameters: { timeUnit: "day" } };
  }
  if (definition.parameter === "event_attribute") {
    const source = getSourceSchema(schema, "events");
    const activity = source?.entity_types.find(
      (item) => semanticAttributes(schema, "events", item, chartType).length,
    );
    const attribute = semanticAttributes(
      schema,
      "events",
      activity,
      chartType,
    )[0]?.name;
    return {
      id,
      parameters: {
        activity,
        attribute,
        ...(chartType === "histogram" ? { bins: 20 } : {}),
      },
    };
  }
  if (definition.parameter === "object_attribute") {
    const source = getSourceSchema(schema, "objects");
    const objectType = source?.entity_types.find(
      (item) => semanticAttributes(schema, "objects", item, chartType).length,
    );
    const attribute = semanticAttributes(
      schema,
      "objects",
      objectType,
      chartType,
    )[0]?.name;
    return {
      id,
      parameters: {
        objectType,
        attribute,
        ...(chartType === "histogram" ? { bins: 20 } : {}),
      },
    };
  }
  return { id, parameters: {} };
}

function dimensionSlotLabel(type: ChartType) {
  if (type === "histogram") return "Value to distribute";
  if (type === "pie") return "Categories";
  if (type === "line" || type === "area") return "Horizontal axis";
  return "Groups";
}

function measureSlotLabel(type: ChartType) {
  if (type === "kpi") return "Value";
  if (type === "pie") return "Segment size";
  return "Vertical axis";
}

export function ChartEditor({
  opened,
  schema,
  initialSpec,
  onClose,
  onSave,
}: ChartEditorProps) {
  const [draft, setDraft] = useState<ChartSpec>(() =>
    initialSpec ? cloneSpec(initialSpec) : createCustomChartSpec(schema),
  );

  useEffect(() => {
    if (!opened) return;
    setDraft(
      initialSpec ? cloneSpec(initialSpec) : createCustomChartSpec(schema),
    );
  }, [initialSpec, opened, schema]);

  const definition = getChartDefinition(draft.chart.type);
  const dimensionDefinition = draft.selection.dimension
    ? getDimensionDefinition(draft.selection.dimension.id)
    : undefined;
  const source = dimensionDefinition?.source;
  const dimensionOptions = dimensionsForChart(draft.chart.type).map((item) => ({
    value: item.id,
    label: item.label,
  }));
  const measureOptions = measuresForSource(source).map((item) => ({
    value: item.id,
    label: item.label,
  }));
  const seriesOptions = source
    ? dimensionsForChart("bar")
        .filter(
          (item) =>
            item.source === source &&
            item.parameter === "none" &&
            item.id !== draft.selection.dimension?.id,
        )
        .map((item) => ({ value: item.id, label: item.label }))
    : [];
  const validationErrors = validateChartSpec(draft, schema);

  const applySelection = (selection: SemanticChartSelection) => {
    setDraft((current) => {
      const query = buildSemanticQuery(schema, current.chart.type, selection);
      return {
        ...current,
        selection,
        query: { ...query, limit: current.query.limit ?? query.limit },
      };
    });
  };

  const changeChartType = (type: ChartType) => {
    const replacement = createCustomChartSpec(schema, type);
    setDraft((current) => ({
      ...replacement,
      id: current.id,
      title:
        current.title === getChartDefinition(current.chart.type).label
          ? replacement.title
          : current.title,
      layout: current.layout,
    }));
  };

  const changeDimension = (id: DimensionExpressionId) => {
    const dimension = initialDimensionSelection(schema, id, draft.chart.type);
    const nextSource = getDimensionDefinition(id).source;
    applySelection({
      dimension,
      measure: countMeasureForSource(nextSource),
    });
  };

  const updateDimensionParameters = (
    parameters: DimensionSelection["parameters"],
  ) => {
    if (!draft.selection.dimension) return;
    applySelection({
      ...draft.selection,
      dimension: { ...draft.selection.dimension, parameters },
    });
  };

  const eventSource = getSourceSchema(schema, "events");
  const objectSource = getSourceSchema(schema, "objects");
  const parameters = draft.selection.dimension?.parameters ?? {};
  const eventAttributes = semanticAttributes(
    schema,
    "events",
    parameters.activity,
    draft.chart.type,
  );
  const objectAttributes = semanticAttributes(
    schema,
    "objects",
    parameters.objectType,
    draft.chart.type,
  );

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={initialSpec ? "Edit visualization" : "Add visualization"}
      position="right"
      size="lg"
      padding="md"
    >
      <Stack gap="md">
        {sectionLabel("Visualization")}
        <TextInput
          label="Title"
          value={draft.title}
          onChange={(event) => {
            const title = event.currentTarget.value;
            setDraft((current) => ({ ...current, title }));
          }}
        />
        <div>
          <Text size="sm" fw={500} mb={6}>
            Chart type
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {CHART_DEFINITIONS.map((item) => {
              const Icon = CHART_ICONS[item.type];
              return (
                <Button
                  key={item.type}
                  variant={
                    draft.chart.type === item.type ? "filled" : "default"
                  }
                  leftSection={<Icon size={16} />}
                  onClick={() => changeChartType(item.type)}
                >
                  {item.label}
                </Button>
              );
            })}
          </SimpleGrid>
        </div>

        <Divider />
        {sectionLabel("What should it show?")}
        {definition.dimension.required && (
          <Select
            label={dimensionSlotLabel(draft.chart.type)}
            searchable
            data={dimensionOptions}
            value={draft.selection.dimension?.id ?? null}
            onChange={(value) =>
              value && changeDimension(value as DimensionExpressionId)
            }
          />
        )}

        {dimensionDefinition?.parameter === "event_attribute" && (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Activity"
              searchable
              data={eventSource?.entity_types ?? []}
              value={parameters.activity ?? null}
              onChange={(activity) => {
                const attribute = semanticAttributes(
                  schema,
                  "events",
                  activity ?? undefined,
                  draft.chart.type,
                )[0]?.name;
                updateDimensionParameters({
                  ...parameters,
                  activity: activity ?? undefined,
                  attribute,
                });
              }}
            />
            <Select
              label="Attribute"
              searchable
              data={eventAttributes.map((field) => field.name)}
              value={parameters.attribute ?? null}
              onChange={(attribute) =>
                updateDimensionParameters({
                  ...parameters,
                  attribute: attribute ?? undefined,
                })
              }
            />
          </SimpleGrid>
        )}

        {dimensionDefinition?.parameter === "object_attribute" && (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Object type"
              searchable
              data={objectSource?.entity_types ?? []}
              value={parameters.objectType ?? null}
              onChange={(objectType) => {
                const attribute = semanticAttributes(
                  schema,
                  "objects",
                  objectType ?? undefined,
                  draft.chart.type,
                )[0]?.name;
                updateDimensionParameters({
                  ...parameters,
                  objectType: objectType ?? undefined,
                  attribute,
                });
              }}
            />
            <Select
              label="Attribute"
              searchable
              data={objectAttributes.map((field) => field.name)}
              value={parameters.attribute ?? null}
              onChange={(attribute) =>
                updateDimensionParameters({
                  ...parameters,
                  attribute: attribute ?? undefined,
                })
              }
            />
          </SimpleGrid>
        )}

        {dimensionDefinition?.parameter === "time" && (
          <Select
            label="Time interval"
            data={TIME_UNITS}
            value={parameters.timeUnit ?? "day"}
            onChange={(timeUnit) =>
              timeUnit &&
              updateDimensionParameters({
                ...parameters,
                timeUnit: timeUnit as TimeUnit,
              })
            }
          />
        )}

        {draft.chart.type === "histogram" && (
          <NumberInput
            label="Number of bins"
            min={1}
            max={500}
            value={parameters.bins ?? 20}
            onChange={(bins) =>
              updateDimensionParameters({
                ...parameters,
                bins: typeof bins === "number" ? bins : 20,
              })
            }
          />
        )}

        <Select
          label={measureSlotLabel(draft.chart.type)}
          data={
            measureOptions.length
              ? measureOptions
              : measuresForSource().map((item) => ({
                  value: item.id,
                  label: item.label,
                }))
          }
          value={draft.selection.measure.id}
          onChange={(value) =>
            value &&
            applySelection({
              ...draft.selection,
              measure: { id: value as SemanticChartSelection["measure"]["id"] },
            })
          }
        />

        {definition.allowsSeries && seriesOptions.length > 0 && (
          <Select
            label="Colour (optional)"
            clearable
            data={seriesOptions}
            value={draft.selection.series?.id ?? null}
            onChange={(value) =>
              applySelection({
                ...draft.selection,
                series: value
                  ? initialDimensionSelection(
                      schema,
                      value as DimensionExpressionId,
                      draft.chart.type,
                    )
                  : undefined,
              })
            }
          />
        )}

        <Divider />
        {sectionLabel("Display")}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {draft.chart.type !== "kpi" && draft.chart.type !== "histogram" && (
            <NumberInput
              label="Maximum groups"
              min={1}
              max={5000}
              value={draft.query.limit}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  query: {
                    ...current.query,
                    limit: typeof value === "number" ? value : 100,
                  },
                }))
              }
            />
          )}
          <Select
            label="Height"
            disabled={draft.chart.type === "kpi"}
            data={[
              { value: "standard", label: "Standard" },
              { value: "large", label: "Large" },
            ]}
            value={draft.layout.height}
            onChange={(value) =>
              value &&
              setDraft((current) => ({
                ...current,
                layout: {
                  ...current.layout,
                  height: value as ChartSpec["layout"]["height"],
                },
              }))
            }
          />
        </SimpleGrid>
        <Group grow>
          <Switch
            label="Full dashboard width"
            checked={draft.layout.width === "full"}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setDraft((current) => ({
                ...current,
                layout: {
                  ...current.layout,
                  width: checked ? "full" : "half",
                },
              }));
            }}
          />
          <Switch
            label="Row drill-down"
            disabled={draft.chart.type === "kpi"}
            checked={draft.chart.type !== "kpi" && draft.interaction.drilldown}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setDraft((current) => ({
                ...current,
                interaction: { drilldown: checked },
              }));
            }}
          />
          {draft.chart.type === "pie" && (
            <Switch
              label="Legend"
              checked={draft.chart.showLegend}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setDraft((current) => ({
                  ...current,
                  chart: { ...current.chart, showLegend: checked },
                }));
              }}
            />
          )}
        </Group>

        {validationErrors.length > 0 && (
          <Alert
            color="orange"
            icon={<CircleAlertIcon size={16} />}
            title="Visualization is incomplete"
          >
            {validationErrors[0]}
          </Alert>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={validationErrors.length > 0}
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save visualization
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
