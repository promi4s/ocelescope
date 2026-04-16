import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import AnnotationElementRefInput from "../AnnotationSection/AnnotationElementRefInput";
import type { AnnotationElementType, AnnotationKind } from "./types";

const AssignmentModal: React.FC<{
  opened: boolean;
  onClose: () => void;
  ocelId: string;
  kind: AnnotationKind;
  elementType?: AnnotationElementType;
  initialElementRef?: string;
  initialValue?: string;
  onSubmit: (values: {
    element_refs: string[];
    value?: string;
  }) => Promise<void>;
}> = ({
  opened,
  onClose,
  ocelId,
  kind,
  elementType,
  initialElementRef,
  initialValue,
  onSubmit,
}) => {
  const isMulti = true;

  const [elementRefs, setElementRefs] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setElementRefs(initialElementRef ? [initialElementRef] : []);
      setValue(initialValue ?? "");
    }
  }, [opened, initialElementRef, initialValue]);

  const helperText = useMemo(() => {
    if (elementType === "event" || elementType === "object") {
      return "Type to search. For ids, only matching results are shown.";
    }
    return null;
  }, [elementType]);

  const handleSubmit = async () => {
    const cleaned = elementRefs.map((x) => x.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    if (kind === "categories" && !value.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        element_refs: cleaned,
        value: kind === "categories" ? value.trim() : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} centered title={"Add assignments"}>
      <Stack>
        {elementType && (
          <Text size="sm" c="dimmed">
            Element type: {elementType}
          </Text>
        )}

        {helperText && (
          <Text size="sm" c="dimmed">
            {helperText}
          </Text>
        )}

        <AnnotationElementRefInput
          ocelId={ocelId}
          elementType={elementType}
          value={elementRefs}
          onChange={(value) =>
            setElementRefs(Array.isArray(value) ? value : value ? [value] : [])
          }
          isMulti={isMulti}
          label="Elements"
        />

        {kind === "categories" && (
          <TextInput
            label="Value"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        )}

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

export default AssignmentModal;
