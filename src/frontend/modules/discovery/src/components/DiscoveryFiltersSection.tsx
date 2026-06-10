import { Card, Stack, Text } from "@mantine/core";
import type { DiscoveryFilterSchema } from "@ocelescope/api-base";
import type { DiscoverySchema, FilterEntry } from "../types";
import { DiscoveryField } from "./DiscoveryField";

const initialPayload = (schema: DiscoverySchema): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (property.default !== undefined) payload[name] = property.default;
    else if (property.type === "array") payload[name] = [];
    else if (
      (property.type === "number" || property.type === "integer") &&
      property.minimum !== undefined
    )
      payload[name] = property.minimum;
  }
  return payload;
};

type Props = {
  availableFilters: DiscoveryFilterSchema[];
  filters: FilterEntry[];
  onFiltersChange: (next: FilterEntry[]) => void;
  eventTypeOptions: string[];
  objectTypeOptions: string[];
};

export const DiscoveryFiltersSection = ({
  availableFilters,
  filters,
  onFiltersChange,
  eventTypeOptions,
  objectTypeOptions,
}: Props) => {
  const updateField = (
    filterName: string,
    schema: DiscoverySchema,
    fieldName: string,
    value: unknown,
  ) => {
    const exists = filters.some((f) => f.name === filterName);
    if (exists) {
      onFiltersChange(
        filters.map((f) =>
          f.name === filterName
            ? { ...f, payload: { ...f.payload, [fieldName]: value } }
            : f,
        ),
      );
    } else {
      onFiltersChange([
        ...filters,
        {
          name: filterName,
          payload: { ...initialPayload(schema), [fieldName]: value },
        },
      ]);
    }
  };

  return (
    <Stack gap="xs">
      <Text fw={500}>Filters</Text>
      {availableFilters.map((filterSchema) => {
        const schema = filterSchema.json_schema as DiscoverySchema;
        const existing = filters.find((f) => f.name === filterSchema.name);
        const payload = existing?.payload ?? initialPayload(schema);

        return (
          <Card key={filterSchema.name} withBorder padding="sm" radius="sm">
            <Text size="sm" fw={500} mb="xs">
              {filterSchema.name}
            </Text>
            <Stack gap="sm">
              {Object.entries(schema.properties ?? {}).map(
                ([fieldName, property]) => (
                  <DiscoveryField
                    key={fieldName}
                    name={fieldName}
                    property={property}
                    value={payload[fieldName]}
                    eventTypeOptions={eventTypeOptions}
                    objectTypeOptions={objectTypeOptions}
                    onChange={(value) =>
                      updateField(filterSchema.name, schema, fieldName, value)
                    }
                  />
                ),
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
};
