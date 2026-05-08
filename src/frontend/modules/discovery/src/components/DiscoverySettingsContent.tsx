import { Alert, Box, Select, Stack, Text } from "@mantine/core";
import type { DiscoveryMethodMeta } from "@ocelescope/api-base";
import type { Dispatch, SetStateAction } from "react";
import type { DiscoverySchema } from "../types";
import { getMethodOptionLabel } from "../utils/labels";
import { DiscoveryField } from "./DiscoveryField";

type DiscoverySettingsContentProps = {
  methods: DiscoveryMethodMeta[];
  selectedMethodId: string | null;
  setSelectedMethodId: (v: string | null) => void;
  selectedMethod: DiscoveryMethodMeta | null;
  selectedSchema: DiscoverySchema;
  activeFormData: Record<string, unknown>;
  setFormDataByMethod: Dispatch<
    SetStateAction<Partial<Record<string, Record<string, unknown>>>>
  >;
  eventCounts: Record<string, unknown>;
  objectCounts: Record<string, unknown>;
  errorMessage: string | undefined;
};

export const DiscoverySettingsContent = ({
  methods,
  selectedMethodId,
  setSelectedMethodId,
  selectedMethod,
  selectedSchema,
  activeFormData,
  setFormDataByMethod,
  eventCounts,
  objectCounts,
  errorMessage,
}: DiscoverySettingsContentProps) => (
  <Stack gap="md">
    <Select
      label="Discovery Method"
      value={selectedMethodId}
      onChange={setSelectedMethodId}
      data={methods.map((method) => ({
        value: method.methodId,
        label: getMethodOptionLabel(method),
      }))}
      allowDeselect={false}
    />
    {selectedMethod?.description && (
      <Text size="sm" c="dimmed">
        {selectedMethod.description}
      </Text>
    )}
    {Object.entries(selectedSchema.properties ?? {}).map(([name, property]) => (
      <Box key={name}>
        <DiscoveryField
          name={name}
          property={property}
          value={activeFormData[name]}
          eventTypeOptions={Object.keys(eventCounts)}
          objectTypeOptions={Object.keys(objectCounts)}
          onChange={(value) =>
            setFormDataByMethod((current) => ({
              ...current,
              [selectedMethodId as string]: {
                ...((selectedMethodId && current[selectedMethodId]) ?? {}),
                [name]: value,
              },
            }))
          }
        />
      </Box>
    ))}
    {errorMessage && (
      <Alert color="red" title="Discovery failed">
        {errorMessage}
      </Alert>
    )}
  </Stack>
);
