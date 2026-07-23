import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";

import { useObjectIds } from "../api/ocel";
import type { ObjectAttributeTimelineSpec } from "../model/dashboard";
import type { AnalysisEditorProps } from "./types";

export function ObjectAttributeTimelineEditor({
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps) {
  const existing =
    initial?.analysis === "object-attribute-timeline" ? initial : undefined;
  const [objectId, setObjectId] = useState<string | null>(
    existing?.query.object_id ?? null,
  );
  const [searchValue, setSearchValue] = useState(objectId ?? "");
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const objectIds = useObjectIds(ocelId, {
    search: debouncedSearch || undefined,
    size: 20,
    ocel_version: "original",
  });
  const [title, setTitle] = useState(existing?.title ?? "");

  const submit = () => {
    if (!objectId) return;
    const spec: ObjectAttributeTimelineSpec = {
      analysis: "object-attribute-timeline",
      query: { object_id: objectId },
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onSubmit(spec);
  };

  return (
    <Stack gap="md">
      <Select
        label="Object"
        description="Search by object id. Every attribute of the object's type is plotted."
        placeholder="Search for an object"
        data={objectIds.data?.response ?? []}
        value={objectId}
        onChange={setObjectId}
        searchable
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        nothingFoundMessage={
          objectIds.isPending ? "Searching…" : "No objects found"
        }
        allowDeselect={false}
      />

      <TextInput
        label="Custom title"
        description="Optional"
        placeholder="Object attribute value development"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!objectId}>
          {existing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}
