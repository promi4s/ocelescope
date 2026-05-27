import { Center, Group, Select, Stack, Text } from "@mantine/core";
import { ChartCard } from "@ocelescope/charts";
import { useCallback, useState } from "react";

import type { AttributeInfo } from "../api/base";
import { useEventAttributes } from "../api/base";
import { AttributeDistributionChart } from "./AttributeDistributionChart";

export function EventAttributeDistributionPanel({ ocelId }: { ocelId: string }) {
  const { data: eventAttributes } = useEventAttributes(ocelId);

  const [eventType, setEventType] = useState<string | null>(null);
  const [attribute, setAttribute] = useState<AttributeInfo | null>(null);

  const handleEventTypeChange = useCallback((next: string | null) => {
    setEventType(next);
    setAttribute(null);
  }, []);

  const eventTypes = Object.keys(eventAttributes ?? {});
  const attributes: AttributeInfo[] = eventType ? (eventAttributes?.[eventType] ?? []) : [];

  return (
    <Stack>
      <Group align="flex-end">
        <Select
          label="Event type"
          placeholder="Select an event type"
          data={eventTypes}
          value={eventType}
          onChange={handleEventTypeChange}
          clearable
          searchable
          style={{ minWidth: 200 }}
        />
        <Select
          label="Attribute"
          placeholder="Select an attribute"
          data={attributes.map((a) => ({ value: a.name, label: a.name }))}
          value={attribute?.name ?? null}
          onChange={(name) => setAttribute(attributes.find((a) => a.name === name) ?? null)}
          disabled={eventType === null}
          clearable
          searchable
          style={{ minWidth: 200 }}
        />
      </Group>

      {eventType && attribute ? (
        <AttributeDistributionChart
          key={`${eventType}-${attribute.name}`}
          ocelId={ocelId}
          eventType={eventType}
          attribute={attribute.name}
          attributeType={attribute.type}
        />
      ) : (
        <ChartCard title="Distribution">
          <Center h="100%">
            <Text c="dimmed" size="sm">
              Select an event type and an attribute to view its distribution.
            </Text>
          </Center>
        </ChartCard>
      )}
    </Stack>
  );
}
