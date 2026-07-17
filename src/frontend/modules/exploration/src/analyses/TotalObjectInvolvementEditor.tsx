import { Button, Group, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { TotalObjectInvolvementSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function TotalObjectInvolvementEditor({
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const existing = initial?.analysis === "total-object-involvement" ? initial : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  return (
    <Stack gap="md">
      <TextInput label="Custom title" description="Optional" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit({
          analysis: "total-object-involvement",
          ...(title.trim() ? { title: title.trim() } : {}),
        } satisfies TotalObjectInvolvementSpec)}>
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
