import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";

import type { ActivityExecutionFrequencySpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ActivityExecutionFrequencyEditor({
  schema,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const existing =
    initial?.analysis === "activity-execution-frequency" ? initial : undefined;
  const [objectType, setObjectType] = useState<string | null>(
    existing?.query.object_type ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? "");

  const submit = () => {
    if (!objectType) return;
    const spec: ActivityExecutionFrequencySpec = {
      analysis: "activity-execution-frequency",
      query: { object_type: objectType },
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      <Select
        label="Object type"
        description="Each object is grouped by its final execution count for every activity."
        data={schema.object_types.map((objectType) => objectType.name)}
        value={objectType}
        onChange={setObjectType}
        placeholder="Select an object type"
        searchable
        allowDeselect={false}
      />

      <TextInput
        label="Custom title"
        description="Optional"
        placeholder="Activity execution frequency"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!objectType}>
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
