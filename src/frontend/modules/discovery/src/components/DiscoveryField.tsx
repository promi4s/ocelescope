import {
  MultiSelect,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import type { DiscoverySchemaProperty } from "../types";

type DiscoveryFieldProps = {
  name: string;
  property: DiscoverySchemaProperty;
  value: unknown;
  eventTypeOptions: string[];
  objectTypeOptions: string[];
  onChange: (value: unknown) => void;
};

export const DiscoveryField = ({
  name,
  property,
  value,
  eventTypeOptions,
  objectTypeOptions,
  onChange,
}: DiscoveryFieldProps) => {
  const label = property.title ?? name;
  const description = property.description;
  const fieldType = property["x-ui-meta"]?.field_type;

  if (property.type === "array" && fieldType === "event_type") {
    return (
      <MultiSelect
        label={label}
        description={description}
        value={(value as string[] | undefined) ?? []}
        onChange={onChange}
        data={eventTypeOptions}
        clearable
        searchable
      />
    );
  }

  if (property.type === "array" && fieldType === "object_type") {
    return (
      <MultiSelect
        label={label}
        description={description}
        value={(value as string[] | undefined) ?? []}
        onChange={onChange}
        data={objectTypeOptions}
        clearable
        searchable
      />
    );
  }

  if (property.type === "string" && property.enum) {
    return (
      <Select
        label={label}
        description={description}
        value={(value as string | undefined) ?? null}
        onChange={onChange}
        data={property.enum.map((item, index) => ({
          value: item,
          label: property.enumNames?.[index] ?? item,
        }))}
        allowDeselect={false}
      />
    );
  }

  if (
    (property.type === "number" || property.type === "integer") &&
    property.minimum !== undefined &&
    property.maximum !== undefined
  ) {
    const currentValue =
      typeof value === "number"
        ? value
        : (property.default as number | undefined);
    const isPercentage = property.maximum === 100 && property.minimum === 0;

    return (
      <Stack gap={6}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
        <Slider
          min={property.minimum}
          max={property.maximum}
          value={currentValue ?? property.minimum}
          onChange={onChange as (value: number) => void}
          label={(val) => (isPercentage ? `${val}%` : val)}
        />
      </Stack>
    );
  }

  if (property.type === "integer" || property.type === "number") {
    return (
      <NumberInput
        label={label}
        description={description}
        value={value as number | string | undefined}
        onChange={onChange}
        min={property.minimum}
        max={property.maximum}
      />
    );
  }

  if (property.type === "boolean") {
    return (
      <Switch
        label={label}
        description={description}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    );
  }

  return (
    <TextInput
      label={label}
      description={description}
      value={(value as string | undefined) ?? ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
};
