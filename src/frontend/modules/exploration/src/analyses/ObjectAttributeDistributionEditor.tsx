import {
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useE2oCombinations, useObjectAttributes } from "../api/ocel";
import {
  compatibleVisualizations,
  type VisualizationKind,
} from "../lib/analyticalCapabilities";
import type {
  DistributionVisualization,
  ObjectAttributeDistributionSpec,
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

export function ObjectAttributeDistributionEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const relationshipOptions = useE2oCombinations(ocelId, {
    direction: "source",
    ocel_version: "original",
  });
  const allObjectAttributes = useObjectAttributes(ocelId, {
    ocel_version: "original",
  });
  const validRelationshipPairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: { activity: string; object_type: string }[] = [];
    for (const combination of relationshipOptions.data ?? []) {
      const key = `${combination.source} ${combination.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        activity: combination.source,
        object_type: combination.target,
      });
    }
    return pairs;
  }, [relationshipOptions.data]);
  const existing =
    initial?.analysis === "object-attribute-distribution" ? initial : undefined;
  const [activity, setActivity] = useState(existing?.query.activity ?? null);
  const [objectType, setObjectType] = useState(
    existing?.query.object_type ?? null,
  );
  const [attributeName, setAttributeName] = useState(
    existing?.query.attribute ?? null,
  );
  const [visualization, setVisualization] =
    useState<DistributionVisualization | null>(existing?.visualization ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [categoryLimit, setCategoryLimit] = useState<number | string>(
    existing?.query.grouping.kind === "categories"
      ? (existing.query.grouping.limit ?? 50)
      : 50,
  );

  const objectTypeAttributes = useObjectAttributes(
    ocelId,
    { names: objectType ? [objectType] : [], ocel_version: "original" },
    { query: { enabled: !!objectType } },
  );
  const attribute = objectTypeAttributes.data?.find(
    (candidate) => candidate.name === attributeName,
  );
  const objectTypesWithAttributes = useMemo(
    () =>
      new Set((allObjectAttributes.data ?? []).map((item) => item.entity_type)),
    [allObjectAttributes.data],
  );
  const validPairs = useMemo(
    () =>
      validRelationshipPairs.filter((pair) =>
        objectTypesWithAttributes.has(pair.object_type),
      ),
    [objectTypesWithAttributes, validRelationshipPairs],
  );
  const availableActivities = useMemo(
    () => Array.from(new Set(validPairs.map((pair) => pair.activity))),
    [validPairs],
  );
  const availableObjectTypes = useMemo(
    () =>
      Array.from(
        new Set(
          validPairs
            .filter((pair) => pair.activity === activity)
            .map((pair) => pair.object_type),
        ),
      ),
    [activity, validPairs],
  );
  const validSelectionPair = validPairs.some(
    (pair) => pair.activity === activity && pair.object_type === objectType,
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
  const validCategoryLimit =
    typeof categoryLimit === "number" &&
    categoryLimit >= 1 &&
    categoryLimit <= 500;

  const submit = () => {
    if (
      !activity ||
      !objectType ||
      !validSelectionPair ||
      !attributeName ||
      !visualization
    )
      return;
    if (visualization !== "histogram" && !validCategoryLimit) return;
    const spec: ObjectAttributeDistributionSpec = {
      analysis: "object-attribute-distribution",
      query: {
        activity,
        object_type: objectType,
        attribute: attributeName,
        grouping:
          visualization === "histogram"
            ? { kind: "bins" }
            : { kind: "categories", limit: categoryLimit as number },
      },
      visualization,
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      {relationshipOptions.isError && (
        <Alert color="red" title="Unable to load valid relationships">
          Activity and object-type choices cannot be configured right now.
        </Alert>
      )}

      <Select
        label="Activity"
        description="Only activities related to object types with attributes are shown."
        placeholder={
          relationshipOptions.isPending
            ? "Loading valid activities"
            : "Select an activity"
        }
        data={availableActivities}
        value={activity}
        onChange={(value) => {
          setActivity(value);
          setObjectType(null);
          setAttributeName(null);
          setVisualization(null);
        }}
        disabled={relationshipOptions.isPending || relationshipOptions.isError}
        searchable
        allowDeselect={false}
      />

      <Select
        label="Object type"
        description="Only object types involved in the selected activity are shown."
        placeholder={
          activity ? "Select an object type" : "Select an activity first"
        }
        data={availableObjectTypes}
        value={objectType}
        onChange={(value) => {
          setObjectType(value);
          setAttributeName(null);
          setVisualization(null);
        }}
        disabled={!activity || relationshipOptions.isPending}
        searchable
        allowDeselect={false}
      />

      <Select
        label="Object attribute"
        description={
          attribute
            ? `${attribute.type} · ${attribute.analytical_type}`
            : undefined
        }
        placeholder={
          objectType ? "Select an attribute" : "Select an object type first"
        }
        data={(objectTypeAttributes.data ?? []).map((item) => ({
          value: item.name,
          label: item.name,
        }))}
        value={attributeName}
        onChange={(value) => {
          setAttributeName(value);
          setVisualization(null);
        }}
        disabled={!objectType || objectTypeAttributes.isPending}
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
            !objectType ||
            !validSelectionPair ||
            !attributeName ||
            !visualization ||
            (visualization !== "histogram" && !validCategoryLimit)
          }
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
