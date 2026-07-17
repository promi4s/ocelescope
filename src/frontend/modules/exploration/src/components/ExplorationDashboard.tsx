import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import type { OcelSchemaResponse } from "@ocelescope/api-querying";
import { useOcelSchema } from "@ocelescope/api-querying";
import { CircleAlertIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { queryErrorMessage } from "../lib/queryError";
import type { ChartSpec } from "../model/chartSpec";
import { useExplorationDashboard } from "../store/useExplorationDashboard";
import { ChartEditor } from "./ChartEditor";
import { ConfiguredChart } from "./ConfiguredChart";

export function ExplorationDashboard({ ocelId }: { ocelId: string }) {
  const schemaQuery = useOcelSchema(ocelId);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editingSpec, setEditingSpec] = useState<ChartSpec | null>(null);

  if (schemaQuery.isPending) return <Skeleton h={420} />;
  if (schemaQuery.error || !schemaQuery.data) {
    return (
      <Alert
        color="red"
        icon={<CircleAlertIcon size={16} />}
        title="Unable to inspect the OCEL"
      >
        {queryErrorMessage(schemaQuery.error)}
      </Alert>
    );
  }

  return (
    <DashboardContent
      key={ocelId}
      ocelId={ocelId}
      schema={schemaQuery.data}
      editorOpened={editorOpened}
      editingSpec={editingSpec}
      onEditorOpenedChange={setEditorOpened}
      onEditingSpecChange={setEditingSpec}
    />
  );
}

interface DashboardContentProps {
  ocelId: string;
  schema: OcelSchemaResponse;
  editorOpened: boolean;
  editingSpec: ChartSpec | null;
  onEditorOpenedChange: (opened: boolean) => void;
  onEditingSpecChange: (spec: ChartSpec | null) => void;
}

function DashboardContent({
  ocelId,
  schema,
  editorOpened,
  editingSpec,
  onEditorOpenedChange,
  onEditingSpecChange,
}: DashboardContentProps) {
  const dashboard = useExplorationDashboard(ocelId);

  const openNewChart = () => {
    onEditingSpecChange(null);
    onEditorOpenedChange(true);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Exploration</Title>
        <Group gap="xs">
          <Tooltip label="Reset dashboard">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Reset dashboard"
              onClick={dashboard.resetDashboard}
            >
              <RotateCcwIcon size={16} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<PlusIcon size={16} />} onClick={openNewChart}>
            Add visualization
          </Button>
        </Group>
      </Group>

      {!dashboard.ready ? (
        <Skeleton h={420} />
      ) : dashboard.charts.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Center mih={240}>
            <Stack align="center" gap="sm">
              <Text c="dimmed">This dashboard has no visualizations.</Text>
              <Button
                variant="light"
                leftSection={<PlusIcon size={16} />}
                onClick={openNewChart}
              >
                Add visualization
              </Button>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          {dashboard.charts.map((spec) => (
            <div
              key={spec.id}
              style={{
                gridColumn: spec.layout.width === "full" ? "1 / -1" : undefined,
                minWidth: 0,
              }}
            >
              <ConfiguredChart
                ocelId={ocelId}
                schema={schema}
                spec={spec}
                onEdit={() => {
                  onEditingSpecChange(spec);
                  onEditorOpenedChange(true);
                }}
                onRemove={() => dashboard.removeChart(spec.id)}
              />
            </div>
          ))}
        </SimpleGrid>
      )}

      <ChartEditor
        opened={editorOpened}
        schema={schema}
        initialSpec={editingSpec}
        onClose={() => onEditorOpenedChange(false)}
        onSave={dashboard.saveChart}
      />
    </Stack>
  );
}
