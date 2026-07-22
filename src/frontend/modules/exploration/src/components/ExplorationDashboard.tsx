import {
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  Group,
  LoadingOverlay,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { PlusIcon, ShapesIcon } from "lucide-react";
import { useState } from "react";
import {
  analysisDefinitions,
  findAnalysisDefinition,
} from "../analyses/registry";
import type { VisualizationSpec } from "../model/dashboard";
import { useExplorationDashboard } from "../store/useExplorationDashboard";

function createCardId() {
  return globalThis.crypto.randomUUID();
}

export function ExplorationDashboard({ ocelId }: { ocelId: string }) {
  const { cards, setCards, loaded } = useExplorationDashboard(ocelId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const editingCard = cards.find((card) => card.id === editingCardId);
  const activeAnalysisId = editingCard?.spec.analysis ?? selectedAnalysis;
  const activeDefinition = activeAnalysisId
    ? findAnalysisDefinition(activeAnalysisId)
    : undefined;
  const ActiveEditor = activeDefinition?.Editor;

  const definitionCategories = Array.from(
    new Set(analysisDefinitions.map((definition) => definition.category)),
  ).map((category) => ({
    category,
    definitions: analysisDefinitions.filter(
      (definition) => definition.category === category,
    ),
  }));

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedAnalysis(null);
    setEditingCardId(null);
  };

  const startAdding = () => {
    setEditingCardId(null);
    setSelectedAnalysis(null);
    setDrawerOpen(true);
  };

  const saveSpec = (spec: VisualizationSpec) => {
    if (editingCardId) {
      setCards((current) =>
        current.map((card) =>
          card.id === editingCardId ? { ...card, spec } : card,
        ),
      );
    } else {
      setCards((current) => [...current, { id: createCardId(), spec }]);
    }
    closeDrawer();
  };

  if (!loaded) return <LoadingOverlay visible />;

  return (
    <Container fluid py="xl" px={{ base: "md", lg: "xl" }}>
      <Stack gap="xl">
        <Group gap="xs">
          <Button leftSection={<PlusIcon size={16} />} onClick={startAdding}>
            Add visualization
          </Button>

          <Badge variant="default">
            {cards.length} visualization{cards.length === 1 ? "" : "s"}
          </Badge>
        </Group>

        {cards.length === 0 ? (
          <Paper
            withBorder
            radius="lg"
            p={48}
            style={{ borderStyle: "dashed" }}
          >
            <Stack align="center" gap="sm" maw={520} mx="auto">
              <ThemeIcon size={52} radius="xl" variant="light">
                <ShapesIcon size={24} />
              </ThemeIcon>
              <Title order={3} ta="center">
                Build your exploration workspace
              </Title>
              <Text c="dimmed" size="sm" ta="center">
                Choose an analytical question, configure its OCEL scope, and
                explicitly select a compatible visualization.
              </Text>
              <Button
                mt="xs"
                leftSection={<PlusIcon size={16} />}
                onClick={startAdding}
              >
                Add first visualization
              </Button>
            </Stack>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            {cards.map((card) => {
              const definition = findAnalysisDefinition(card.spec.analysis);
              if (!definition) return null;
              const Card = definition.Card;
              return (
                <Box key={card.id} h={420}>
                  <Card
                    ocelId={ocelId}
                    card={card}
                    onEdit={() => {
                      setSelectedAnalysis(null);
                      setEditingCardId(card.id);
                      setDrawerOpen(true);
                    }}
                    onDuplicate={() =>
                      setCards((current) => [
                        ...current,
                        { id: createCardId(), spec: card.spec },
                      ])
                    }
                    onRemove={() =>
                      setCards((current) =>
                        current.filter((candidate) => candidate.id !== card.id),
                      )
                    }
                  />
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>

      <Drawer
        opened={drawerOpen}
        onClose={closeDrawer}
        position="right"
        size="md"
        title={editingCard ? "Edit visualization" : "Add visualization"}
        padding="lg"
      >
        {activeDefinition && ActiveEditor ? (
          <Stack gap="lg">
            <div>
              <Title order={4}>{activeDefinition.label}</Title>
              <Text size="sm" c="dimmed" mt={4}>
                {activeDefinition.description}
              </Text>
            </div>
            <ActiveEditor
              key={editingCard?.id ?? activeDefinition.id}
              ocelId={ocelId}
              initial={editingCard?.spec}
              onCancel={closeDrawer}
              onSubmit={saveSpec}
            />
          </Stack>
        ) : (
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Start with the analytical question. Its configuration will only
              offer attributes and visualizations compatible with the schema.
            </Text>
            {definitionCategories.map(({ category, definitions }) => (
              <Stack key={category} gap="xs">
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  {category}
                </Text>
                {definitions.map((definition) => (
                  <Paper key={definition.id} withBorder radius="md" p="md">
                    <Stack gap="xs">
                      <Text fw={650}>{definition.label}</Text>
                      <Text size="sm" c="dimmed">
                        {definition.description}
                      </Text>
                      <Button
                        variant="light"
                        mt="xs"
                        onClick={() => setSelectedAnalysis(definition.id)}
                      >
                        Configure
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ))}
          </Stack>
        )}
      </Drawer>
    </Container>
  );
}
