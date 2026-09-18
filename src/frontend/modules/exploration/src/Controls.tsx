/**
 * The parameter inputs a card is configured with.
 *
 * Anything chosen out of the log - an activity, an object type, an attribute,
 * an object - is one of core's pickers, so choosing here reads the same
 * endpoints and looks the same as on every other page. The rest is Mantine.
 */
import {
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  useEventAttributes,
  useObjectAttributes,
  ValueType,
} from "@ocelescope/api-base";
import {
  ActivityPicker,
  EventAttributePicker,
  ObjectAttributePicker,
  ObjectPicker,
  ObjectTypePicker,
  useCurrentOcel,
} from "@ocelescope/core";
import type { Param, Values } from "./analyses";

/** The value types a chart bins; the rest it counts by value. */
const BINNED: string[] = [ValueType.int, ValueType.float];

/**
 * Whether a card's attribute holds numbers, which is what decides bins versus
 * value counts. A card names one attribute, of its activity or of its object
 * type, so both lists are asked and whichever holds it answers.
 */
export const useNumeric = (values: Values) => {
  const { id } = useCurrentOcel();
  const activity =
    values.activity == null
      ? []
      : Array.isArray(values.activity)
        ? values.activity.map(String)
        : [String(values.activity)];
  const type = values.object_type == null ? [] : [String(values.object_type)];
  const events = useEventAttributes(
    id,
    { names: activity },
    { query: { enabled: id != null && activity.length > 0 } },
  );
  const objects = useObjectAttributes(
    id,
    { names: type },
    { query: { enabled: id != null && type.length > 0 } },
  );

  return (attribute: string) =>
    [...(events.data ?? []), ...(objects.data ?? [])].some(
      (candidate) =>
        candidate.name === attribute && BINNED.includes(candidate.type),
    );
};

export const Control = ({
  param,
  values,
  onChange,
}: {
  param: Param;
  values: Values;
  onChange: (value: Values[string]) => void;
}) => {
  const value = values[param.name];

  if (param.kind === "number") {
    return (
      <NumberInput
        size="xs"
        label={param.label}
        min={param.min}
        max={param.max}
        value={Number(value ?? param.default ?? 0)}
        onChange={(next) =>
          onChange(typeof next === "number" ? next : undefined)
        }
      />
    );
  }

  if (param.kind === "activities") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <Stack gap={4}>
        <ActivityPicker
          label={param.label}
          multiple
          value={selected}
          onChange={onChange}
        />
        <Text size="xs" c="dimmed">
          Leave empty to include all activities.
        </Text>
      </Stack>
    );
  }

  if (param.kind === "choice") {
    return (
      <Select
        size="xs"
        label={param.label}
        data={[...(param.options ?? [])]}
        value={String(value ?? param.options?.[0] ?? "")}
        onChange={(next) => onChange(next ?? undefined)}
        allowDeselect={false}
      />
    );
  }

  if (param.kind === "text" || param.kind === "column") {
    return (
      <TextInput
        label={param.label}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(event.currentTarget.value || undefined)}
      />
    );
  }

  if (param.kind === "sql") {
    return (
      <Textarea
        label={param.label}
        autosize
        minRows={6}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(event.currentTarget.value || undefined)}
        styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
      />
    );
  }

  if (param.kind === "columns") return null;

  const chosen = { value: value == null ? null : String(value), onChange };

  if (param.kind === "object") {
    return <ObjectPicker label={param.label} {...chosen} />;
  }

  // An attribute belongs to an activity or to an object type, so the card has
  // to name one before there is anything to choose from.
  if (param.kind === "eventAttribute") {
    return (
      <EventAttributePicker
        label={param.label}
        activity={values.activity == null ? undefined : String(values.activity)}
        disabled={values.activity == null}
        {...chosen}
      />
    );
  }

  if (param.kind === "objectAttribute") {
    return (
      <ObjectAttributePicker
        label={param.label}
        objectType={
          values.object_type == null ? undefined : String(values.object_type)
        }
        disabled={values.object_type == null}
        {...chosen}
      />
    );
  }

  if (param.kind === "activity") {
    return <ActivityPicker label={param.label} {...chosen} />;
  }
  if (param.kind === "objectType") {
    return <ObjectTypePicker label={param.label} {...chosen} />;
  }
  return null;
};
