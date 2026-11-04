import {
  Box,
  Center,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  readLocalStorageValue,
  useDebouncedCallback,
  useLocalStorage,
} from "@mantine/hooks";
import { InfoIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  Controller,
  type DefaultValues,
  type Path,
  useForm,
  useWatch,
} from "react-hook-form";
import { PipelineList } from "./PipelineList";
import type {
  BaseStep,
  PipelineForm,
  StepKinds,
  UseView,
  ViewBuilderLabels,
  ViewBuilderState,
} from "./types";
import { completeSteps, kindOf } from "./util";

type Draft<S> = { base: S[]; steps: S[] };

const DEFAULT_LABELS: ViewBuilderLabels = {
  title: "Pipeline",
  add: "Add step",
  search: "Search steps",
  noMatch: "No step matches",
  emptyList: "No steps yet. Add one to start the pipeline.",
  emptyEditor: "Add a step to the pipeline on the right to start.",
  selectHint: "Select a step on the right to edit it.",
};

export type OCELViewBuilderProps<S extends BaseStep> = {
  ocelId: string;
  kinds: StepKinds<S>;
  useView: UseView<S>;
  defaultSteps?: S[];
  storageKey?: string;
  labels?: Partial<ViewBuilderLabels>;
  actions?: (state: ViewBuilderState<S>) => ReactNode;
};

export const OCELViewBuilder = <S extends BaseStep>({
  ocelId,
  kinds,
  useView,
  defaultSteps = [],
  storageKey,
  labels: labelOverrides,
  actions,
}: OCELViewBuilderProps<S>) => {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const form = useForm<PipelineForm<S>>({
    defaultValues: { steps: defaultSteps } as DefaultValues<PipelineForm<S>>,
  });

  const { control, reset, formState, subscribe } = form;

  const steps = useWatch({
    control,
    name: "steps" as Path<PipelineForm<S>>,
  }) as S[];

  const [selected, setSelected] = useState<number | undefined>(
    defaultSteps.length > 0 ? 0 : undefined,
  );

  const draftKey = storageKey
    ? `ocelescope:${storageKey}:${ocelId}`
    : undefined;
  const base = JSON.stringify(defaultSteps);
  const [, setDraft, removeDraft] = useLocalStorage<Draft<S>>({
    key: draftKey ?? "",
    sync: false,
  });

  useEffect(() => {
    if (!draftKey) {
      return;
    }
    const draft = readLocalStorageValue<Draft<S>>({ key: draftKey });
    if (!draft) {
      return;
    }
    if (JSON.stringify(draft.base) !== base) {
      removeDraft();
      return;
    }
    reset({ steps: draft.steps } as PipelineForm<S>, {
      keepDefaultValues: true,
    });
    setSelected(draft.steps.length > 0 ? 0 : undefined);
  }, [draftKey, base, reset, removeDraft]);

  const saveDraft = useDebouncedCallback(
    (next: S[], isDirty: boolean) => {
      if (!draftKey) {
        return;
      }
      if (isDirty) {
        setDraft({ base: defaultSteps, steps: next });
      } else {
        removeDraft();
      }
    },
    { delay: 400, flushOnUnmount: true },
  );

  useEffect(
    () =>
      subscribe({
        formState: { values: true, isDirty: true },
        callback: ({ values, isDirty }) =>
          saveDraft(values.steps, isDirty ?? false),
      }),
    [subscribe, saveDraft],
  );

  const selectedStep = selected === undefined ? undefined : steps[selected];
  const before = completeSteps(kinds, steps.slice(0, selected ?? 0));
  const viewId = useView(ocelId, before);

  const state: ViewBuilderState<S> = {
    steps,
    completeSteps: completeSteps(kinds, steps),
    isDirty: formState.isDirty,
    reset: () => {
      reset();
      setSelected(defaultSteps.length > 0 ? 0 : undefined);
    },
  };

  const kind = selectedStep && kindOf(kinds, selectedStep);

  return (
    <Group h="100%" gap={0} wrap="nowrap" align="stretch">
      <Box
        flex={1}
        miw={0}
        p="md"
        style={{ overflow: "auto", display: "flex", flexDirection: "column" }}
      >
        {selected !== undefined && kind ? (
          <Stack gap="md" flex={1} mih={0}>
            <Stack gap={4}>
              <Title order={4}>
                {selected + 1}. {kind.title}
              </Title>
              <Text size="sm" c="dimmed">
                {kind.description}
              </Text>
            </Stack>
            {viewId === undefined ? (
              <Center flex={1} mih={120}>
                <Loader size="sm" />
              </Center>
            ) : (
              <Controller
                key={selected}
                control={control}
                name={`steps.${selected}` as Path<PipelineForm<S>>}
                render={({ field }) => (
                  <kind.Panel
                    ocelId={ocelId}
                    viewId={viewId}
                    step={field.value as S}
                    onChange={(step) =>
                      field.onChange({ target: { value: step } })
                    }
                  />
                )}
              />
            )}
          </Stack>
        ) : (
          <Center flex={1}>
            <Text c="dimmed" size="sm" maw={360} ta="center">
              {steps.length === 0 ? labels.emptyEditor : labels.selectHint}
            </Text>
          </Center>
        )}
      </Box>

      <Stack
        w={320}
        gap="sm"
        py="md"
        style={{ borderLeft: "1px solid var(--mantine-color-default-border)" }}
      >
        <Group justify="space-between" wrap="nowrap" h={28} px="md">
          <Group gap={6} wrap="nowrap">
            <Title order={5} lh={1}>
              {labels.title}
            </Title>
            {labels.note && (
              <Tooltip label={labels.note} multiline w={280} withArrow>
                <InfoIcon
                  size={16}
                  color="var(--mantine-color-dimmed)"
                  aria-label="How the pipeline runs"
                />
              </Tooltip>
            )}
          </Group>
          <Group justify="flex-end" gap={4} wrap="nowrap" ml="auto">
            {actions?.(state)}
          </Group>
        </Group>
        <Divider />
        <PipelineList
          flex={1}
          mih={0}
          px="md"
          kinds={kinds}
          control={control}
          labels={labels}
          selected={selected}
          onSelect={setSelected}
        />
      </Stack>
    </Group>
  );
};
