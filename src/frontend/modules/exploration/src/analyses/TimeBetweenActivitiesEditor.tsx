import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { useState } from "react";

import { useGetObjectAttributeDistributionOptions } from "../api/querying";
import type { TimeUnit } from "../api/timeBetweenActivities";
import type { TimeBetweenActivitiesSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

const unitOptions: { value: TimeUnit; label: string }[] = [
  { value: "seconds", label: "Seconds" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
];

export function TimeBetweenActivitiesEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const options = useGetObjectAttributeDistributionOptions(ocelId);
  const existing =
    initial?.analysis === "time-between-activities" ? initial : undefined;
  const [source, setSource] = useState<string | null>(
    existing?.query.source_activity ?? null,
  );
  const [target, setTarget] = useState<string | null>(
    existing?.query.target_activity ?? null,
  );
  const [objectType, setObjectType] = useState<string | null>(
    existing?.query.object_type ?? null,
  );
  const [unit, setUnit] = useState<TimeUnit>(
    existing?.query.unit ?? "hours",
  );
  const [binCount, setBinCount] = useState<number | string>(
    existing?.query.bin_count ?? 20,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const availableObjectTypes = Array.from(
    new Set(options.data?.pairs.map((pair) => pair.object_type) ?? []),
  ).sort();
  const activities = Array.from(
    new Set(
      (options.data?.pairs ?? [])
        .filter((pair) => pair.object_type === objectType)
        .map((pair) => pair.activity),
    ),
  ).sort();
  const validBinCount =
    typeof binCount === "number" && binCount >= 1 && binCount <= 200;

  const submit = () => {
    if (!source || !target || !objectType || !validBinCount) return;
    const spec: TimeBetweenActivitiesSpec = {
      analysis: "time-between-activities",
      query: {
        source_activity: source,
        target_activity: target,
        object_type: objectType,
        unit,
        bin_count: binCount,
      },
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      <Select
        label="Object type"
        description="Only object types with event–object relations are available."
        data={availableObjectTypes}
        value={objectType}
        onChange={(value) => {
          setObjectType(value);
          setSource(null);
          setTarget(null);
        }}
        placeholder={
          options.isPending ? "Loading object types" : "Select an object type"
        }
        disabled={options.isPending || options.isError}
        searchable
        allowDeselect={false}
      />
      <Select
        label="Source activity"
        data={activities}
        value={source}
        onChange={setSource}
        placeholder={
          objectType ? "Select the source activity" : "Select an object type first"
        }
        disabled={!objectType}
        searchable
        allowDeselect={false}
      />
      <Select
        label="Target activity"
        description="The target must immediately follow the source after filtering the object trace to these two activities."
        data={activities}
        value={target}
        onChange={setTarget}
        placeholder={
          objectType ? "Select the target activity" : "Select an object type first"
        }
        disabled={!objectType}
        searchable
        allowDeselect={false}
      />
      <Group grow align="flex-start">
        <Select
          label="Time unit"
          data={unitOptions}
          value={unit}
          onChange={(value) => setUnit((value as TimeUnit) ?? "hours")}
          allowDeselect={false}
        />
        <NumberInput
          label="Number of bins"
          value={binCount}
          onChange={setBinCount}
          min={1}
          max={200}
          clampBehavior="strict"
        />
      </Group>
      <TextInput
        label="Custom title"
        description="Optional"
        placeholder="Time between activities"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={!source || !target || !objectType || !validBinCount}
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
