import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import type { AnnotationElementType, AnnotationKind } from "./types";

const elementTypeOptions: { value: AnnotationElementType; label: string }[] = [
  { value: "event", label: "Event" },
  { value: "activity", label: "Activity" },
  { value: "object", label: "Object" },
  { value: "object_type", label: "Object Type" },
  { value: "item_type", label: "Item Type" },
];

const DefinitionModal: React.FC<{
  opened: boolean;
  onClose: () => void;
  kind: AnnotationKind;
  mode: "create" | "rename";
  initialName?: string;
  initialElementType?: AnnotationElementType;
  onSubmit: (values: {
    name: string;
    element_type?: AnnotationElementType;
  }) => Promise<void>;
}> = ({
  opened,
  onClose,
  kind,
  mode,
  initialName,
  initialElementType,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [elementType, setElementType] = useState<AnnotationElementType | null>(
    "event",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setName(initialName ?? "");
      setElementType(initialElementType ?? "event");
    }
  }, [opened, initialName, initialElementType]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (mode === "create" && !elementType) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        element_type:
          mode === "create" ? (elementType ?? undefined) : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      title={
        mode === "create"
          ? `Create ${kind === "labels" ? "label" : "category"}`
          : `Rename ${kind === "labels" ? "label" : "category"}`
      }
    >
      <Stack>
        {mode === "create" && (
          <Select
            label="Element type"
            data={elementTypeOptions}
            value={elementType}
            onChange={(value) => setElementType(value as AnnotationElementType)}
            allowDeselect={false}
          />
        )}

        <TextInput
          label="Name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          autoFocus
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={handleSubmit}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DefinitionModal;
