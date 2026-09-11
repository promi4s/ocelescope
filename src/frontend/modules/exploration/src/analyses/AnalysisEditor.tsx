import {
  Alert,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyChange,
  asOption,
  buildSpec,
  type Field,
  type FieldContext,
  type FieldValues,
  initialValues,
  isComplete,
  isVisible,
  list,
  number,
  text,
} from "./fields";
import { useSources } from "./sources";
import type { AnalysisDefinition, AnalysisEditorProps } from "./types";

const resolve = <T,>(
  value: T | ((context: FieldContext) => T),
  context: FieldContext,
): T =>
  typeof value === "function"
    ? (value as (context: FieldContext) => T)(context)
    : value;

/**
 * The only editor in the module. Which inputs appear, how they constrain each
 * other and what they build is data on the analysis definition.
 */
export function AnalysisEditor({
  definition,
  ocelId,
  initial,
  onCancel,
  onSubmit,
}: AnalysisEditorProps & { definition: AnalysisDefinition }) {
  const { form } = definition;
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const sources = useSources(ocelId, debouncedSearch);

  const [values, setValues] = useState<FieldValues>(() =>
    initialValues(form, initial, definition.id),
  );
  const context = useMemo<FieldContext>(
    () => ({ sources, values }),
    [sources, values],
  );

  const change = (key: string, value: FieldValues[string]) =>
    setValues((current) => applyChange(form.fields, current, key, value));

  // "All activities" is the useful default, but the list only exists once the
  // sources resolve. Seed once, and never over an existing card's selection.
  const seeded = useRef(initial != null);
  useEffect(() => {
    if (seeded.current || sources.loading) return;
    seeded.current = true;
    setValues((current) => {
      const next = { ...current };
      for (const field of form.fields) {
        if (field.kind !== "multiselect" || !field.selectAllByDefault) continue;
        if (list(current, field.key).length > 0) continue;
        next[field.key] = field
          .options({ sources, values: current })
          .map((option) => asOption(option).value);
      }
      return next;
    });
  }, [form.fields, initial, sources]);

  const editing = initial?.analysis === definition.id;
  const complete = isComplete(form.fields, context);

  const render = (field: Field) => {
    if (!isVisible(field, context)) return null;
    const description = resolve(field.description, context);

    switch (field.kind) {
      case "select":
      case "multiselect": {
        const options = field.options(context).map(asOption);
        const blocked = options.length === 0 && field.waitingFor !== undefined;
        const placeholder = blocked
          ? field.waitingFor
          : sources.loading
            ? "Loading"
            : `Select ${field.label.toLocaleLowerCase()}`;

        if (field.kind === "multiselect") {
          return (
            <MultiSelect
              key={field.key}
              label={field.label}
              description={description}
              placeholder={field.placeholder ?? placeholder}
              data={options}
              value={list(values, field.key)}
              onChange={(next) => change(field.key, next)}
              searchable
              clearable
            />
          );
        }

        return (
          <Select
            key={field.key}
            label={field.label}
            description={description}
            placeholder={placeholder}
            data={options}
            value={text(values, field.key)}
            onChange={(next) => change(field.key, next)}
            disabled={blocked || sources.failed}
            searchable={field.searchable ?? true}
            allowDeselect={false}
            {...(field.remoteSearch
              ? {
                  searchValue: search,
                  onSearchChange: setSearch,
                  filter: identity,
                }
              : {})}
          />
        );
      }

      case "number":
        return (
          <NumberInput
            key={field.key}
            label={field.label}
            description={description}
            value={number(values, field.key) ?? field.initial}
            onChange={(next) =>
              change(field.key, typeof next === "number" ? next : field.initial)
            }
            min={field.min}
            max={field.max}
            clampBehavior="strict"
          />
        );

      case "text":
        return (
          <TextInput
            key={field.key}
            label={field.label}
            description={description}
            placeholder={resolve(field.placeholder, context)}
            value={text(values, field.key) ?? ""}
            onChange={(event) => change(field.key, event.currentTarget.value)}
          />
        );
    }
  };

  return (
    <Stack gap="md">
      {sources.failed && (
        <Alert color="red" title="Unable to load the available choices">
          This analysis cannot be configured right now.
        </Alert>
      )}

      {form.fields.map(render)}

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!complete}
          onClick={() =>
            onSubmit(buildSpec(definition.id, form, values, context))
          }
        >
          {editing ? "Save changes" : "Add visualization"}
        </Button>
      </Group>
    </Stack>
  );
}

/** The object-id search is served by the backend, so keep every option. */
const identity = ({ options }: { options: unknown[] }) => options as never;
