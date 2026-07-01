import { Card, Stack, Text } from "@mantine/core";
import type { DiscoveryFilterSchema } from "@ocelescope/api-base";
import type { DiscoverySchema, FilterEntry } from "../types";
import { DiscoveryForm } from "./DiscoveryForm";

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
  const handleChange = (filterName: string, data: Record<string, unknown>) => {
    const exists = filters.some((f) => f.name === filterName);
    if (exists) {
      onFiltersChange(
        filters.map((f) =>
          f.name === filterName ? { ...f, payload: data } : f,
        ),
      );
    } else {
      onFiltersChange([...filters, { name: filterName, payload: data }]);
    }
  };

  return (
    <Stack gap="xs">
      <Text fw={500}>Filters</Text>
      {availableFilters.map((filterSchema) => {
        const schema = filterSchema.json_schema as DiscoverySchema;
        const payload =
          filters.find((f) => f.name === filterSchema.name)?.payload ?? {};

        return (
          <Card key={filterSchema.name} withBorder padding="sm" radius="sm">
            <Text size="sm" fw={500} mb="xs">
              {filterSchema.name}
            </Text>
            <DiscoveryForm
              schema={schema}
              formData={payload}
              onChange={(data) => handleChange(filterSchema.name, data)}
              eventTypeOptions={eventTypeOptions}
              objectTypeOptions={objectTypeOptions}
            />
          </Card>
        );
      })}
    </Stack>
  );
};
