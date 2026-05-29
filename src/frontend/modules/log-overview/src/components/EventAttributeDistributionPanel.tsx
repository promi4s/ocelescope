import { Center, Group, Select, Stack, Text } from "@mantine/core";
import { ChartCard } from "@ocelescope/charts";
import { useCallback, useMemo, useState } from "react";

import { useEventAttributes } from "../api/base";
import { AttributeDistributionChart } from "./AttributeDistributionChart";

export function EventAttributeDistributionPanel({
  ocelId,
}: {
  ocelId: string;
}) {
  const { data: eventAttributes = {} } = useEventAttributes(ocelId);

  const [eventType, setEventType] = useState<string | null>(null);
  const [attribute, setAttribute] = useState<string | null>(null);

  const handleEventTypeChange = useCallback((next: string | null) => {
    setEventType(next);
    setAttribute(null);
  }, []);

  const eventTypes = useMemo(() => {
    return Object.keys(eventAttributes);
  }, [eventAttributes]);

  const attributes = useMemo(() => {
    return eventAttributes[eventType ?? ""] ?? [];
  }, [eventAttributes, eventType]);

  return (
    <>
      {!eventTypes || !eventTypes.length ? (
        <Text>The OCEL does not contain any event attributes</Text>
      ) : (
        <Stack>
          <Group align="flex-end">
            <Select
              label="Activity"
              placeholder="Select an activity"
              data={eventTypes}
              value={eventType}
              onChange={handleEventTypeChange}
              clearable
              searchable
            />
            <Select
              label="Numeric attribute"
              placeholder="Select an attribute"
              data={attributes.map((a) => ({ value: a.name, label: a.name }))}
              value={attribute}
              onChange={setAttribute}
              disabled={eventType === null}
              clearable
              searchable
            />
          </Group>
          {eventType && attribute ? (
            <AttributeDistributionChart
              key={`${eventType}-${attribute}`}
              ocelId={ocelId}
              eventType={eventType}
              attribute={attribute}
            />
          ) : (
            <ChartCard title="Distribution">
              <Center h="100%">
                <Text c="dimmed" size="sm">
                  Select an event type and a numeric attribute to view its
                  histogram.
                </Text>
              </Center>
            </ChartCard>
          )}
        </Stack>
      )}
    </>
  );
}
