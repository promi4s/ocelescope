import {
  Alert,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import type { OcelSchemaResponse } from "@ocelescope/api-querying";
import { useOcelQuery } from "@ocelescope/api-querying";
import { CircleAlertIcon } from "lucide-react";
import { useMemo } from "react";

import { queryErrorMessage } from "../lib/queryError";
import { getSourceSchema } from "../model/analysisQuery";
import { drillDownQuery, formatChartValue } from "../model/chartRuntime";
import type { ChartSelection, ChartSpec } from "../model/chartSpec";

interface ChartDrillDownProps {
  ocelId: string;
  schema: OcelSchemaResponse;
  spec: ChartSpec;
  selection: ChartSelection;
  onClose: () => void;
}

export function ChartDrillDown({
  ocelId,
  schema,
  spec,
  selection,
  onClose,
}: ChartDrillDownProps) {
  const sourceName = spec.query.source;
  const source = getSourceSchema(schema, sourceName);
  const query = useMemo(
    () => drillDownQuery(spec, schema, selection),
    [schema, selection, spec],
  );
  const result = useOcelQuery(ocelId, query);

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size="xl"
      title={selection.label}
      padding="md"
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Matching {sourceName}
        </Text>

        {result.isPending ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : result.error ? (
          <Alert
            color="red"
            icon={<CircleAlertIcon size={16} />}
            title="Unable to load matching rows"
          >
            {queryErrorMessage(result.error)}
          </Alert>
        ) : !result.data?.rows.length ? (
          <Text size="sm" c="dimmed">
            No matching rows.
          </Text>
        ) : (
          <>
            <Text size="xs" c="dimmed">
              Showing {result.data.rows.length.toLocaleString("en-US")} of{" "}
              {result.data.stats.result_rows.toLocaleString("en-US")} rows
            </Text>
            <ScrollArea h="calc(100vh - 150px)" type="auto">
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                stickyHeader
                verticalSpacing={6}
                fz="xs"
              >
                <Table.Thead>
                  <Table.Tr>
                    {result.data.columns.map((column) => (
                      <Table.Th key={column.name}>{column.name}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.data.rows.map((row, index) => (
                    <Table.Tr
                      key={`${String(row[source?.id_field ?? ""] ?? "row")}-${index}`}
                    >
                      {result.data.columns.map((column) => (
                        <Table.Td
                          key={column.name}
                          ff={
                            column.type === "number" ? "monospace" : undefined
                          }
                        >
                          {formatChartValue(row[column.name])}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
