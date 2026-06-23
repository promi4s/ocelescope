import { Alert, Box, Divider, Select, Stack, Text } from "@mantine/core";
import type {
  DiscoveryFilterSchema,
  DiscoveryMethodMeta,
} from "@ocelescope/api-base";
import type { DiscoverySchema, FilterEntry } from "../types";
import { DiscoveryField } from "./DiscoveryField";
import { DiscoveryFiltersSection } from "./DiscoveryFiltersSection";

type DiscoverySettingsContentProps = {
  methods: DiscoveryMethodMeta[];
  selectedMethodId: string | null;
  setSelectedMethodId: (id: string | null) => void;
  selectedMethod: DiscoveryMethodMeta | null;
  selectedSchema: DiscoverySchema;
  activeFormData: Record<string, unknown>;
  setActiveFormData: (data: Record<string, unknown>) => void;
  eventCounts: Record<string, unknown>;
  objectCounts: Record<string, unknown>;
  errorMessage: string | undefined;
  availableFilters: DiscoveryFilterSchema[];
  filters: FilterEntry[];
  setFilters: (filters: FilterEntry[]) => void;
};

export const DiscoverySettingsContent = ({
  methods,
  selectedMethodId,
  setSelectedMethodId,
  selectedMethod,
  selectedSchema,
  activeFormData,
  setActiveFormData,
  eventCounts,
  objectCounts,
  errorMessage,
  availableFilters,
  filters,
  setFilters,
}: DiscoverySettingsContentProps) => {
  const selectedVariants = selectedMethod?.variants ?? [];

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Select
          label="Discovery Method"
          value={selectedMethod?.name ?? null}
          onChange={(name) => {
            const group = methods.find((m) => m.name === name);
            setSelectedMethodId(group?.variants[0]?.methodId ?? null);
          }}
          data={methods.map((m) => ({ value: m.name, label: m.name }))}
          allowDeselect={false}
        />
        {selectedVariants.length > 1 && (
          <>
            <Select
              label="Output Format"
              value={selectedMethodId}
              onChange={setSelectedMethodId}
              data={selectedVariants.map((v) => ({
                value: v.methodId,
                label: v.resourceType,
              }))}
              allowDeselect={false}
            />
            <Text size="sm" c="dimmed">
              {
                selectedVariants.find((v) => v.methodId == selectedMethodId)
                  ?.description
              }
            </Text>
          </>
        )}
        {Object.entries(selectedSchema.properties ?? {}).map(
          ([name, property]) => (
            <Box key={name}>
              <DiscoveryField
                name={name}
                property={property}
                value={activeFormData[name]}
                eventTypeOptions={Object.keys(eventCounts)}
                objectTypeOptions={Object.keys(objectCounts)}
                onChange={(value) =>
                  setActiveFormData({ ...activeFormData, [name]: value })
                }
              />
            </Box>
          ),
        )}
      </Stack>

      <Divider />

      <DiscoveryFiltersSection
        availableFilters={availableFilters}
        filters={filters}
        onFiltersChange={setFilters}
        eventTypeOptions={Object.keys(eventCounts)}
        objectTypeOptions={Object.keys(objectCounts)}
      />

      {errorMessage && (
        <Alert color="red" title="Discovery failed">
          {errorMessage}
        </Alert>
      )}
    </Stack>
  );
};
