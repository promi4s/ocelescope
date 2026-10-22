import {
  ActionIcon,
  ActionIconGroup,
  Box,
  Center,
  Group,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { CheckIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import type { FilterKey, NativeFilter, Pipeline } from "../types/filter";
import { completeSteps, FILTER_KINDS, kindOf } from "./FilterViews";
import PipelineList from "./Pipeline/PipelineList";

type FilterFormProps = {
  ocelId: string;
  currentFilter: NativeFilter[];
  onSubmit?: (filters: NativeFilter[]) => void;
};

const CLEANUP_NOTE =
  "After the last step the log is cleaned up: relations whose event or object is gone are removed, events without at least one E2O relation are filtered out, and objects without any E2O or O2O relation are filtered out too.";

const FilterForm = ({ ocelId, currentFilter, onSubmit }: FilterFormProps) => {
  const { control, handleSubmit, reset, formState } = useForm<Pipeline>({
    defaultValues: { steps: currentFilter },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "steps",
  });
  const steps = useWatch({ control, name: "steps" });

  const [selectedId, setSelectedId] = useState<string | undefined>(
    fields[0]?.id,
  );
  const ids = fields.map(({ id }) => id);
  const selectedIndex = fields.findIndex(({ id }) => id === selectedId);
  const selectedStep = steps[selectedIndex];

  const selectAdded = useRef(false);
  useEffect(() => {
    if (selectAdded.current) {
      selectAdded.current = false;
      setSelectedId(fields[fields.length - 1]?.id);
    }
  }, [fields]);

  const addStep = (key: FilterKey) => {
    selectAdded.current = true;
    append(FILTER_KINDS[key].create());
  };

  return (
    <Group h="100%" gap={0} wrap="nowrap" align="stretch">
      <Box flex={1} miw={0} p="md" style={{ overflow: "auto" }}>
        {selectedStep ? (
          <Stack gap="md" h="100%">
            <Stack gap={4}>
              <Title order={4}>
                {selectedIndex + 1}. {kindOf(selectedStep).title}
              </Title>
              <Text size="sm" c="dimmed">
                {kindOf(selectedStep).description}
              </Text>
            </Stack>
            <Controller
              key={selectedId}
              control={control}
              name={`steps.${selectedIndex}`}
              render={({ field }) => {
                const { Panel } = kindOf(field.value);
                return (
                  <Panel
                    ocelId={ocelId}
                    filter={field.value}
                    onChange={(step) =>
                      field.onChange({ target: { value: step } })
                    }
                  />
                );
              }}
            />
          </Stack>
        ) : (
          <Center h="100%">
            <Text c="dimmed" size="sm" maw={360} ta="center">
              {fields.length === 0
                ? "Add a filter to the pipeline on the right to start filtering."
                : "Select a step on the right to edit it."}
            </Text>
          </Center>
        )}
      </Box>

      <Stack
        w={320}
        gap="sm"
        p="md"
        style={{ borderLeft: "1px solid var(--mantine-color-default-border)" }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Title order={5}>Pipeline</Title>
          <ActionIconGroup>
            {formState.isDirty && (
              <>
                <Tooltip label="Apply">
                  <ActionIcon
                    onClick={handleSubmit((data) =>
                      onSubmit?.(completeSteps(data.steps)),
                    )}
                    size="lg"
                    color="green"
                  >
                    <CheckIcon size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Discard changes">
                  <ActionIcon
                    size="lg"
                    color="yellow"
                    onClick={() => reset({ steps: currentFilter })}
                  >
                    <RotateCcwIcon size={20} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            {currentFilter.length > 0 && (
              <Tooltip label="Remove all filters">
                <ActionIcon
                  size="lg"
                  color="red"
                  onClick={() => onSubmit?.([])}
                >
                  <Trash2Icon size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </ActionIconGroup>
        </Group>
        <ScrollArea flex={1} mih={0} type="auto" offsetScrollbars>
          <PipelineList
            ids={ids}
            steps={steps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={remove}
            onMove={move}
            onAdd={addStep}
          />
        </ScrollArea>
        <Text size="xs" c="dimmed">
          {CLEANUP_NOTE}
        </Text>
      </Stack>
    </Group>
  );
};

export default FilterForm;
