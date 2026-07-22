import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";

import { useObjectTypes } from "../api/ocel";
import type { ActivityExecutionFrequencySpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ActivityExecutionFrequencyEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const objectTypes = useObjectTypes(ocelId, { ocel_version: "original" });
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
        data={objectTypes.data ?? []}
        value={objectType}
        onChange={setObjectType}
        placeholder={
          objectTypes.isPending
            ? "Loading object types"
            : "Select an object type"
        }
        disabled={objectTypes.isPending || objectTypes.isError}
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
