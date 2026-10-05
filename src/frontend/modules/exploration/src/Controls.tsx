/**
 * The parameter inputs a card is configured with.
 *
 * Anything chosen out of the log - an activity, an object type, an attribute,
 * an object - is one of core's pickers, so choosing here reads the same
 * endpoints and looks the same as on every other page. The rest is Mantine.
 */
import {
  Box,
  Group,
  Input,
  NumberInput,
  SegmentedControl,
  Stack,
  ThemeIcon,
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
import { CheckIcon } from "lucide-react";
import { type Analysis, hasValue, type Param, type Values } from "./analyses";

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

/** Whether a parameter narrows another: its choices depend on the activity. */
const followsActivity = (analysis: Analysis, param: Param) =>
  param.kind === "eventAttribute" ||
  (param.kind === "objectType" &&
    param.required !== false &&
    analysis.params.some((other) => other.name === "activity"));

/**
 * The parameters to clear when one changes, because what they offer depends
 * on it: an attribute on its activity or object type, an object type on the
 * activity it is narrowed to.
 */
export const dependents = (analysis: Analysis, changed: Param) => {
  const stale = (param: Param) =>
    (changed.name === "activity" && followsActivity(analysis, param)) ||
    (changed.name === "object_type" && param.kind === "objectAttribute");
  const names = analysis.params.filter(stale).map((param) => param.name);
  // An object type cleared with its activity takes its attribute along.
  return changed.name === "activity" && names.includes("object_type")
    ? [
        ...names,
        ...analysis.params
          .filter((param) => param.kind === "objectAttribute")
          .map((param) => param.name),
      ]
    : names;
};

/**
 * An analysis's parameters as numbered steps. A step shows a check once it
 * has a value; the next one to fill is highlighted, and optional ones are
 * dashed - so what is left to do is seen rather than read.
 */
export const Fields = ({
  analysis,
  values,
  onChange,
}: {
  analysis: Analysis;
  values: Values;
  onChange: (param: Param, value: Values[string]) => void;
}) => {
  const next = analysis.params.find(
    (param) => param.required !== false && !hasValue(values[param.name]),
  );

  return (
    <Stack gap="md">
      {analysis.params.map((param, index) => {
        const done = hasValue(values[param.name]);
        return (
          <Group key={param.name} gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon
              size={22}
              radius="xl"
              color={done ? "teal" : param === next ? "blue" : "gray"}
              variant={done || param === next ? "filled" : "outline"}
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderStyle: param.required === false ? "dashed" : undefined,
              }}
            >
              {done ? <CheckIcon size={13} /> : index + 1}
            </ThemeIcon>
            <Box flex={1} miw={0}>
              <Control
                analysis={analysis}
                param={param}
                values={values}
                onChange={(value) => onChange(param, value)}
              />
            </Box>
          </Group>
        );
      })}
    </Stack>
  );
};

const Control = ({
  analysis,
  param,
  values,
  onChange,
}: {
  analysis: Analysis;
  param: Param;
  values: Values;
  onChange: (value: Values[string]) => void;
}) => {
  const value = values[param.name];
  const activity =
    typeof values.activity === "string" ? values.activity : undefined;

  if (param.kind === "number") {
    return (
      <NumberInput
        label={param.label}
        min={param.min}
        max={param.max}
        value={Number(value ?? 0)}
        onChange={(next) =>
          onChange(typeof next === "number" ? next : undefined)
        }
      />
    );
  }

  // Few enough to show them all, so nothing has to be opened to see them.
  if (param.kind === "choice") {
    return (
      <Input.Wrapper label={param.label}>
        <SegmentedControl
          fullWidth
          data={[...(param.options ?? [])]}
          value={String(value ?? "")}
          onChange={onChange}
        />
      </Input.Wrapper>
    );
  }

  if (param.kind === "activities") {
    return (
      <ActivityPicker
        label={param.label}
        placeholder="All activities"
        multiple
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={onChange}
      />
    );
  }

  const chosen = { value: value == null ? null : String(value), onChange };

  if (param.kind === "activity") {
    return <ActivityPicker label={param.label} {...chosen} />;
  }

  if (param.kind === "objectType") {
    const narrowed = followsActivity(analysis, param);
    return (
      <ObjectTypePicker
        label={param.label}
        activity={narrowed ? activity : undefined}
        disabled={narrowed && activity === undefined}
        {...(param.required === false && { placeholder: "All object types" })}
        {...chosen}
      />
    );
  }

  if (param.kind === "object") {
    return <ObjectPicker label={param.label} {...chosen} />;
  }

  // An attribute belongs to an activity or to an object type, so the card has
  // to name one before there is anything to choose from.
  if (param.kind === "eventAttribute") {
    return (
      <EventAttributePicker
        label={param.label}
        activity={activity}
        disabled={activity === undefined}
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

  // The remaining kinds belong to the custom chart, which has its own form.
  return null;
};
