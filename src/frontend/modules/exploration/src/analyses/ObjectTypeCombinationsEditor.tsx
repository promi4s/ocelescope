import {
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";

import { useActivities } from "../api/ocel";
import type { ObjectTypeCombinationsSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ObjectTypeCombinationsEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const activitiesQuery = useActivities(ocelId, { ocel_version: "original" });
  const allActivities = activitiesQuery.data ?? [];
  const existing =
    initial?.analysis === "object-type-combinations" ? initial : undefined;
  const [activities, setActivities] = useState<string[]>(
    existing?.query.activities ?? [],
  );
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && !existing && activitiesQuery.data) {
      setActivities(activitiesQuery.data);
      setSeeded(true);
    }
  }, [seeded, existing, activitiesQuery.data]);
  const [limit, setLimit] = useState<number | string>(
    existing?.query.limit ?? 15,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const validLimit = typeof limit === "number" && limit >= 1 && limit <= 50;

  const submit = () => {
    if (!validLimit || activities.length === 0) return;
    const selectsAll = activities.length === allActivities.length;
    const spec: ObjectTypeCombinationsSpec = {
      analysis: "object-type-combinations",
      query: {
        limit,
        activities: selectsAll ? [] : activities,
      },
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      <MultiSelect
        label="Activities"
        description="Select one activity for simple bars, or several to compare them as stacks."
        data={allActivities}
        value={activities}
        onChange={setActivities}
        placeholder={
          activitiesQuery.isPending
            ? "Loading activities"
            : "Select one or more activities"
        }
        disabled={activitiesQuery.isPending || activitiesQuery.isError}
        searchable
        clearable
        hidePickedOptions
      />

      <NumberInput
        label="Maximum combinations"
        description="The most frequent exact object-type combinations are shown."
        value={limit}
        onChange={setLimit}
        min={1}
        max={50}
        clampBehavior="strict"
      />

      <TextInput
        label="Custom title"
        description="Optional"
        placeholder="Object-type combinations per event"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={!validLimit || activities.length === 0}
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
