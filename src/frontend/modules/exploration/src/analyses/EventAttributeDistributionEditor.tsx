import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import {
  compatibleVisualizations,
  type VisualizationKind,
} from "../lib/analyticalCapabilities";
import type {
  DistributionVisualization,
  EventAttributeDistributionSpec,
} from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

const visualizationLabels: Record<DistributionVisualization, string> = {
  bar: "Bar chart",
  donut: "Donut chart",
  histogram: "Histogram",
};

const isDistributionVisualization = (
  value: VisualizationKind,
): value is DistributionVisualization =>
  value === "bar" || value === "donut" || value === "histogram";

export function EventAttributeDistributionEditor({
  schema,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const existing =
    initial?.analysis === "event-attribute-distribution" ? initial : undefined;
  const [activity, setActivity] = useState(existing?.query.activity ?? null);
  const [attributeName, setAttributeName] = useState(
    existing?.query.attribute ?? null,
  );
  const [visualization, setVisualization] =
    useState<DistributionVisualization | null>(existing?.visualization ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [binCount, setBinCount] = useState<number | string>(
    existing?.query.grouping.kind === "bins"
      ? (existing.query.grouping.count ?? 20)
      : 20,
  );
  const [categoryLimit, setCategoryLimit] = useState<number | string>(
    existing?.query.grouping.kind === "categories"
      ? (existing.query.grouping.limit ?? 50)
      : 50,
  );

  const activitySchema = schema.activities.find(
    (candidate) => candidate.name === activity,
  );
  const attribute = activitySchema?.attributes.find(
    (candidate) => candidate.name === attributeName,
  );
  const visualizationOptions = useMemo(
    () =>
      attribute
        ? compatibleVisualizations(attribute.analytical_type)
            .filter(isDistributionVisualization)
            .map((value) => ({ value, label: visualizationLabels[value] }))
        : [],
    [attribute],
  );
  const validBinCount =
    typeof binCount === "number" && binCount >= 1 && binCount <= 200;
  const validCategoryLimit =
    typeof categoryLimit === "number" &&
    categoryLimit >= 1 &&
    categoryLimit <= 500;

  const setSelectedAttribute = (value: string | null) => {
    setAttributeName(value);
    setVisualization(null);
  };

  const submit = () => {
    if (!activity || !attributeName || !visualization) return;
    if (visualization === "histogram" && !validBinCount) return;
    if (visualization !== "histogram" && !validCategoryLimit) return;
    const spec: EventAttributeDistributionSpec = {
      analysis: "event-attribute-distribution",
      query: {
        activity,
        attribute: attributeName,
        grouping:
          visualization === "histogram"
            ? { kind: "bins", count: binCount as number }
            : { kind: "categories", limit: categoryLimit as number },
      },
      visualization,
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      <Select
        label="Activity"
        placeholder="Select an activity"
        data={schema.activities.map((item) => item.name)}
        value={activity}
        onChange={(value) => {
          setActivity(value);
          setAttributeName(null);
          setVisualization(null);
        }}
        searchable
        allowDeselect={false}
      />

      <Select
        label="Attribute"
        description={
          attribute
            ? `${attribute.physical_type} · ${attribute.analytical_type}`
            : "Attributes are classified on the schema page."
        }
        placeholder={
          activity ? "Select an attribute" : "Select an activity first"
        }
        data={(activitySchema?.attributes ?? []).map((item) => ({
          value: item.name,
          label: item.name,
        }))}
        value={attributeName}
        onChange={setSelectedAttribute}
        disabled={!activity}
        searchable
        allowDeselect={false}
      />

      <Select
        label="Visualization"
        description="Choose how the distribution should be shown."
        placeholder={
          attributeName ? "Select a visualization" : "Select an attribute first"
        }
        data={visualizationOptions}
        value={visualization}
        onChange={(value) =>
          setVisualization(value as DistributionVisualization | null)
        }
        disabled={!attributeName || visualizationOptions.length === 0}
        allowDeselect={false}
      />

      {visualization === "histogram" && (
        <NumberInput
          label="Number of bins"
          value={binCount}
          onChange={setBinCount}
          min={1}
          max={200}
          clampBehavior="strict"
        />
      )}

      {(visualization === "bar" || visualization === "donut") && (
        <NumberInput
          label="Maximum categories"
          description="Remaining values are combined into Other."
          value={categoryLimit}
          onChange={setCategoryLimit}
          min={1}
          max={500}
          clampBehavior="strict"
        />
      )}

      <TextInput
        label="Custom title"
        description="Optional"
        placeholder={
          attributeName ? `${attributeName} distribution` : "Distribution title"
        }
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={
            !activity ||
            !attributeName ||
            !visualization ||
            (visualization === "histogram" && !validBinCount) ||
            (visualization !== "histogram" && !validCategoryLimit)
          }
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
