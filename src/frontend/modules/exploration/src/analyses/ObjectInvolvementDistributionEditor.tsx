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

import { useGetObjectInvolvementOptions } from "../api/querying";
import type { ObjectInvolvementDistributionSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ObjectInvolvementDistributionEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const options = useGetObjectInvolvementOptions(ocelId);
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
  const [binCount, setBinCount] = useState<number | string>(
    existing?.query.grouping.kind === "bins"
      ? (existing.query.grouping.count ?? 10)
      : 10,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const activities = useMemo(
    () =>
      Array.from(
        new Set(options.data?.pairs.map((pair) => pair.activity) ?? []),
      ),
    [options.data],
  );
  const objectTypes = useMemo(
    () =>
      (options.data?.pairs ?? [])
        .filter((pair) => pair.activity === activity)
        .map((pair) => ({
          value: pair.object_type,
          label: `${pair.object_type} (${pair.minimum}–${pair.maximum})`,
        })),
    [activity, options.data],
  );
  const validPair = options.data?.pairs.some(
    (pair) => pair.activity === activity && pair.object_type === objectType,
  );
  const validBinCount =
    typeof binCount === "number" && binCount >= 1 && binCount <= 200;

  const submit = () => {
    if (!activity || !objectType || !validPair) return;
    if (visualization === "histogram" && !validBinCount) return;
    const spec: ObjectInvolvementDistributionSpec = {
      analysis: "object-involvement-distribution",
      query: {
        activity,
        object_type: objectType,
        grouping:
          visualization === "histogram"
            ? { kind: "bins", count: binCount as number }
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

      {visualization === "histogram" && (
        <NumberInput
          label="Number of bins"
          description="Object counts are grouped into numerical intervals."
          value={binCount}
          onChange={setBinCount}
          min={1}
          max={200}
          clampBehavior="strict"
        />
      )}

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
          disabled={
            !activity ||
            !objectType ||
            !validPair ||
            (visualization === "histogram" && !validBinCount)
          }
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
