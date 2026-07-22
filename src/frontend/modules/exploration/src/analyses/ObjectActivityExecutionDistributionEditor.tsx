import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { ObjectActivityExecutionDistributionSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ObjectActivityExecutionDistributionEditor({
  schema,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const existing =
    initial?.analysis === "object-activity-execution-distribution"
      ? initial
      : undefined;
  const [objectType, setObjectType] = useState<string | null>(
    existing?.query.object_type ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  return (
    <Stack gap="md">
      <Select
        label="Object type"
        data={schema.object_types.map((item) => item.name)}
        value={objectType}
        onChange={setObjectType}
        searchable
        allowDeselect={false}
      />
      <TextInput
        label="Custom title"
        description="Optional"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!objectType}
          onClick={() => {
            if (!objectType) return;
            onSubmit({
              analysis: "object-activity-execution-distribution",
              query: { object_type: objectType },
              ...(title.trim() ? { title: title.trim() } : {}),
            } satisfies ObjectActivityExecutionDistributionSpec);
          }}
        >
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
