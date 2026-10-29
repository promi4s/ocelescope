import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { GripVerticalIcon, XIcon } from "lucide-react";
import type { NativeFilter } from "../../types/filter";
import { kindOf } from "../FilterViews";

type PipelineStepProps = {
  id: string;
  index: number;
  step: NativeFilter;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

const PipelineStep = ({
  id,
  index,
  step,
  selected,
  onSelect,
  onRemove,
}: PipelineStepProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const kind = kindOf(step);
  const complete = kind.isComplete(step);

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      onClick={onSelect}
      bg={selected ? "var(--mantine-primary-color-light)" : undefined}
      style={{
        cursor: "pointer",
        overflow: "hidden",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1 : undefined,
        position: "relative",
      }}
    >
      <Group gap={0} wrap="nowrap" align="stretch">
        <UnstyledButton
          aria-label="Drag to reorder"
          w={24}
          display="flex"
          bg="var(--mantine-color-default-hover)"
          c="dimmed"
          style={{
            alignItems: "center",
            justifyContent: "center",
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            borderRight: "1px solid var(--mantine-color-default-border)",
          }}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon size={14} />
        </UnstyledButton>
        <Group gap="xs" wrap="nowrap" align="start" flex={1} miw={0} p="xs">
          <Stack gap={2} flex={1} miw={0}>
            <Group gap={6} wrap="nowrap">
              <Text size="xs" c="dimmed">
                {index + 1}
              </Text>
              <Text size="sm" fw={500} truncate>
                {kind.title}
              </Text>
              {!complete && (
                <Badge size="xs" color="yellow" variant="light">
                  incomplete
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {kind.summary(step)}
            </Text>
          </Stack>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label="Remove step"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <XIcon size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
};

export default PipelineStep;
