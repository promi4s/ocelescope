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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Button,
  Menu,
  ScrollArea,
  Stack,
  type StackProps,
  Text,
} from "@mantine/core";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  type Control,
  type FieldArray,
  type FieldArrayPath,
  type Path,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { PipelineStep } from "./PipelineStep";
import type {
  BaseStep,
  PipelineForm,
  StepKinds,
  StepType,
  ViewBuilderLabels,
} from "./types";

type OwnProps<S extends BaseStep> = {
  kinds: StepKinds<S>;
  control: Control<PipelineForm<S>>;
  labels: ViewBuilderLabels;
  selected?: number;
  onSelect: (index: number | undefined) => void;
};

type PipelineListProps<S extends BaseStep> = OwnProps<S> &
  Omit<StackProps, keyof OwnProps<S>>;

export const PipelineList = <S extends BaseStep>({
  kinds,
  control,
  labels,
  selected,
  onSelect,
  ...stackProps
}: PipelineListProps<S>) => {
  const [search, setSearch] = useState("");
  const types = Object.keys(kinds) as StepType<S>[];
  const shown = types.filter((type) =>
    kinds[type].title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "steps" as FieldArrayPath<PipelineForm<S>>,
  });

  const steps = useWatch({
    control,
    name: "steps" as Path<PipelineForm<S>>,
  }) as S[];

  const ids = fields.map(({ id }) => id);

  const add = (type: StepType<S>) => {
    append(kinds[type].create() as FieldArray<PipelineForm<S>>);
    onSelect(fields.length);
  };

  const selectedId = selected === undefined ? undefined : ids[selected];
  const reselect = (next: string[]) => {
    const index = selectedId === undefined ? -1 : next.indexOf(selectedId);
    onSelect(index === -1 ? undefined : index);
  };

  const onRemove = (index: number) => {
    remove(index);
    reselect(ids.filter((_, i) => i !== index));
  };

  const onMove = (from: number, to: number) => {
    move(from, to);
    reselect(arrayMove(ids, from, to));
  };

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
    <Stack gap="xs" {...stackProps}>
      <ScrollArea flex={1} mih={0} type="auto" scrollbarSize={6}>
        <Stack gap="xs">
          {fields.length === 0 && (
            <Text size="sm" c="dimmed">
              {labels.emptyList}
            </Text>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {fields.map(({ id }, index) => {
                const step = steps[index];
                return (
                  step && (
                    <PipelineStep
                      key={id}
                      id={id}
                      index={index}
                      step={step}
                      kinds={kinds}
                      selected={index === selected}
                      onSelect={() => onSelect(index)}
                      onRemove={() => onRemove(index)}
                    />
                  )
                );
              })}
            </SortableContext>
          </DndContext>
        </Stack>
      </ScrollArea>
      <Menu position="bottom-start" width="target">
        <Menu.Target>
          <Button
            variant="light"
            leftSection={<PlusIcon size={16} />}
            fullWidth
          >
            {labels.add}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Search
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={labels.search}
          />
          {shown.map((type) => (
            <Menu.Item key={type} onClick={() => add(type)}>
              {kinds[type].title}
            </Menu.Item>
          ))}
          {shown.length === 0 && <Menu.Label>{labels.noMatch}</Menu.Label>}
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
};
