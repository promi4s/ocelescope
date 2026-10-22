import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, Menu, Stack, Text } from "@mantine/core";
import { PlusIcon } from "lucide-react";
import type { FilterKey, NativeFilter } from "../../types/filter";
import { FILTER_KINDS } from "../FilterViews";
import PipelineStep from "./PipelineStep";

type PipelineListProps = {
  ids: string[];
  steps: NativeFilter[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: (kind: FilterKey) => void;
};

const PipelineList = ({
  ids,
  steps,
  selectedId,
  onSelect,
  onRemove,
  onMove,
  onAdd,
}: PipelineListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  return (
    <Stack gap="xs">
      {ids.length === 0 && (
        <Text size="sm" c="dimmed">
          No filters yet. Add one to start the pipeline.
        </Text>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id, index) => {
            const step = steps[index];
            return (
              step && (
                <PipelineStep
                  key={id}
                  id={id}
                  index={index}
                  step={step}
                  selected={id === selectedId}
                  onSelect={() => onSelect(id)}
                  onRemove={() => onRemove(index)}
                />
              )
            );
          })}
        </SortableContext>
      </DndContext>
      <Menu position="bottom-start" width="target">
        <Menu.Target>
          <Button
            variant="light"
            leftSection={<PlusIcon size={16} />}
            fullWidth
          >
            Add filter
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {(Object.keys(FILTER_KINDS) as FilterKey[]).map((key) => (
            <Menu.Item key={key} onClick={() => onAdd(key)}>
              {FILTER_KINDS[key].title}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
};

export default PipelineList;
