import {
  ActionIcon,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import type { DiscoveryFilterSchema } from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import type { DiscoverySchema, FilterEntry } from "../types";
import { DiscoveryField } from "./DiscoveryField";

const initialPayload = (schema: DiscoverySchema) => {
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
  const schemaByName = new Map(
    availableFilters.map((f) => [f.name, f.json_schema as DiscoverySchema]),
  );

  const addFilter = (name: string) => {
    const schema = schemaByName.get(name);
    if (!schema) return;
    onFiltersChange([...filters, { name, payload: initialPayload(schema) }]);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: string, value: unknown) => {
    onFiltersChange(
      filters.map((f, i) =>
        i === index ? { ...f, payload: { ...f.payload, [field]: value } } : f,
      ),
    );
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          Filters
        </Text>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button
              size="xs"
              variant="light"
              leftSection={<PlusIcon size={14} />}
              disabled={availableFilters.length === 0}
            >
              Add filter
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {availableFilters.map((f) => (
              <Menu.Item key={f.name} onClick={() => addFilter(f.name)}>
                {f.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {filters.length === 0 && (
        <Text size="xs" c="dimmed">
          No filters applied. The full OCEL is passed to the algorithm.
        </Text>
      )}

      {filters.map((entry, index) => {
        const schema = schemaByName.get(entry.name);
        return (
          <Card key={index} withBorder padding="sm" radius="sm">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                {entry.name}
              </Text>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => removeFilter(index)}
                aria-label="Remove filter"
              >
                <XIcon size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="sm">
              {Object.entries(schema?.properties ?? {}).map(
                ([fieldName, property]) => (
                  <DiscoveryField
                    key={fieldName}
                    name={fieldName}
                    property={property}
                    value={entry.payload[fieldName]}
                    eventTypeOptions={eventTypeOptions}
                    objectTypeOptions={objectTypeOptions}
                    onChange={(value) => updateField(index, fieldName, value)}
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
