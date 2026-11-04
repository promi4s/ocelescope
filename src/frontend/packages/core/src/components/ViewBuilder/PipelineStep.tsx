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
import type { ReactNode } from "react";

type PipelineStepProps = {
  id: string;
  index: number;
  title: string;
  summary: ReactNode;
  problem?: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

export const PipelineStep = ({
  id,
  index,
  title,
  summary,
  problem,
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
                {title}
              </Text>
              {problem && (
                <Badge size="xs" color="yellow" variant="light">
                  incomplete
                </Badge>
              )}
            </Group>
            <Text size="xs" c={problem ? "yellow" : "dimmed"} truncate>
              {problem ?? summary}
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
