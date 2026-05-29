import {
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import type { HistogramBin } from "@ocelescope/charts";
import { InfoIcon } from "lucide-react";

import { useEventAttributeInstances } from "../../api/base";

interface Props {
  ocelId: string;
  eventType: string;
  attribute: string;
  bin: HistogramBin;
}

const fmtNum = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(3);
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(5).replace(/\.?0+$/, "");
};

const fmtTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toISOString().replace("T", " ").slice(0, 19)
    : iso;
};

export function AttributeDrillDown({
  ocelId,
  eventType,
  attribute,
  bin,
}: Props) {
  const { data, isLoading } = useEventAttributeInstances(
    ocelId,
    eventType,
    attribute,
    { range: { min: bin.start, max: bin.end }, limit: 100 },
    undefined,
  );

  const header = (
    <Stack gap={0} miw={0} pr="xl">
      <Text fw={600} size="sm">
        Events in [{fmtNum(bin.start)}, {fmtNum(bin.end)})
      </Text>
      <Text size="xs" c="dimmed">
        {attribute} · {eventType}
      </Text>
    </Stack>
  );

  if (isLoading || !data) {
    return (
      <Stack gap="sm">
        {header}
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      </Stack>
    );
  }

  if (data.instances.length === 0) {
    return (
      <Stack gap="sm">
        {header}
        <Text c="dimmed" size="sm">
          No events fall in this bin.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {header}

      <Group gap="xs">
        <Text size="xs" c="dimmed">
          Showing {data.instances.length.toLocaleString("en-US")} of{" "}
          {data.matching_count.toLocaleString("en-US")} matching event
          {data.matching_count === 1 ? "" : "s"}
        </Text>
        {data.truncated && (
          <Group gap={4} align="center" wrap="nowrap" c="blue">
            <InfoIcon size={12} />
            <Text size="xs" lh={1}>
              Truncated to first 100 by timestamp
            </Text>
          </Group>
        )}
      </Group>

      <ScrollArea h={Math.min(360, data.instances.length * 36 + 48)}>
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          stickyHeader
          verticalSpacing={4}
          fz="xs"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Event ID</Table.Th>
              <Table.Th>Timestamp</Table.Th>
              <Table.Th ta="right">{attribute}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.instances.map((instance) => (
              <Table.Tr key={instance.id}>
                <Table.Td ff="monospace">{instance.id}</Table.Td>
                <Table.Td>{fmtTimestamp(instance.timestamp)}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {fmtNum(instance.value)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
