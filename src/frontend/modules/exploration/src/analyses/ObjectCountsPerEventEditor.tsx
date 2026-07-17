import { Button, Group, MultiSelect, Stack, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";

import type { ObjectCountsPerEventSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ObjectCountsPerEventEditor({
  schema,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const existing =
    initial?.analysis === "object-counts-per-event" ? initial : undefined;
  const allActivities = useMemo(
    () => schema.activities.map((activity) => activity.name),
    [schema.activities],
  );
  const [activities, setActivities] = useState<string[]>(
    existing?.query.activities?.length
      ? existing.query.activities
      : allActivities,
  );
  const [title, setTitle] = useState(existing?.title ?? "");

  const submit = () => {
    if (activities.length === 0) return;
    const selectsAll = activities.length === allActivities.length;
    const spec: ObjectCountsPerEventSpec = {
      analysis: "object-counts-per-event",
      query: { activities: selectsAll ? [] : activities },
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      <MultiSelect
        label="Activities"
        description="All activities are selected by default."
        data={allActivities}
        value={activities}
        onChange={setActivities}
        placeholder="Select one or more activities"
        searchable
        clearable
        hidePickedOptions
      />

      <TextInput
        label="Custom title"
        description="Optional"
        placeholder="Objects involved per event"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={activities.length === 0}>
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
