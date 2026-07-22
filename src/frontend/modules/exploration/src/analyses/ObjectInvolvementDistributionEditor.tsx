import { Alert, Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";

import { useE2o } from "../api/ocel";
import type { ObjectInvolvementDistributionSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ObjectInvolvementDistributionEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const options = useE2o(ocelId, {
    direction: "source",
    with_qualifier: false,
    drop_constant: true,
    ocel_version: "original",
  });
  const pairs = options.data?.response;
  const existing =
    initial?.analysis === "object-involvement-distribution"
      ? initial
      : undefined;
  const [activity, setActivity] = useState(existing?.query.activity ?? null);
  const [objectType, setObjectType] = useState(
    existing?.query.object_type ?? null,
  );
  const [visualization, setVisualization] = useState<"bar" | "histogram">(
    existing?.visualization ?? "bar",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const activities = useMemo(
    () => Array.from(new Set(pairs?.map((pair) => pair.source) ?? [])),
    [pairs],
  );
  const objectTypes = useMemo(
    () =>
      (pairs ?? [])
        .filter((pair) => pair.source === activity)
        .map((pair) => ({
          value: pair.target,
          label: `${pair.target} (${pair.min_count}–${pair.max_count})`,
        })),
    [activity, pairs],
  );
  const validPair = pairs?.some(
    (pair) => pair.source === activity && pair.target === objectType,
  );

  const submit = () => {
    if (!activity || !objectType || !validPair) return;
    const spec: ObjectInvolvementDistributionSpec = {
      analysis: "object-involvement-distribution",
      query: {
        activity,
        object_type: objectType,
        grouping:
          visualization === "histogram"
            ? { kind: "bins" }
            : { kind: "categories", limit: 500 },
      },
      visualization,
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      {options.isError && (
        <Alert color="red" title="Unable to load variable relationships">
          Activity and object-type choices cannot be configured right now.
        </Alert>
      )}

      <Select
        label="Activity"
        description="Only activities with variable object involvement are shown."
        data={activities}
        value={activity}
        onChange={(value) => {
          setActivity(value);
          setObjectType(null);
        }}
        placeholder={
          options.isPending ? "Loading activities" : "Select an activity"
        }
        disabled={options.isPending || options.isError}
        searchable
        allowDeselect={false}
      />

      <Select
        label="Object type"
        description="The observed minimum and maximum counts are shown."
        data={objectTypes}
        value={objectType}
        onChange={setObjectType}
        placeholder={
          activity ? "Select an object type" : "Select an activity first"
        }
        disabled={!activity}
        searchable
        allowDeselect={false}
      />

      <Select
        label="Visualization"
        data={[
          { value: "bar", label: "Bar chart" },
          { value: "histogram", label: "Histogram" },
        ]}
        value={visualization}
        onChange={(value) =>
          setVisualization((value as "bar" | "histogram") ?? "bar")
        }
        allowDeselect={false}
      />

      <TextInput
        label="Custom title"
        description="Optional"
        placeholder="Object involvement distribution"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={!activity || !objectType || !validPair}
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
