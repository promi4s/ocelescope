import {
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  ShapesIcon,
} from "lucide-react";
import { useState } from "react";
import { AnalysisCard } from "../analyses/AnalysisCard";
import { AnalysisEditor } from "../analyses/AnalysisEditor";
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
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const editingCard = cards.find((card) => card.id === editingCardId);
  const activeAnalysisId = editingCard?.spec.analysis ?? selectedAnalysis;
  const activeDefinition = activeAnalysisId
    ? findAnalysisDefinition(activeAnalysisId)
    : undefined;

  const definitionCategories = Array.from(
    new Set(analysisDefinitions.map((definition) => definition.category)),
  ).map((category) => ({
    category,
    definitions: analysisDefinitions.filter(
      (definition) =>
        definition.category === category &&
        `${definition.label} ${definition.description} ${category}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ),
  }));

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedAnalysis(null);
    setEditingCardId(null);
  };

  const startAdding = () => {
    setSearch("");
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

  if (!loaded)
    return (
      <Container fluid p="lg" aria-label="Loading exploration dashboard">
        <Stack gap="lg">
          <Skeleton height={56} radius="md" />
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Skeleton height={380} radius="md" />
            <Skeleton height={380} radius="md" />
          </SimpleGrid>
        </Stack>
      </Container>
    );

  return (
    <Container fluid py="xl" px={{ base: "md", lg: "xl" }}>
      <Stack gap="xl">
        <Group justify="space-between" align="center" gap="md">
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2} size="h3">
                Exploration
              </Title>
              <Badge variant="light" color="gray" size="sm">
                {cards.length} visualization{cards.length === 1 ? "" : "s"}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Explore behavior, relationships, and attributes in your event log.
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon size={16} />} onClick={startAdding}>
            Add visualization
          </Button>
        </Group>

        {cards.length === 0 ? (
          <Paper withBorder radius="md" py={{ base: 40, sm: 64 }} px="lg">
            <Stack align="center" gap="sm" maw={520} mx="auto">
              <ThemeIcon size={52} radius="xl" variant="light">
                <ShapesIcon size={24} />
              </ThemeIcon>
              <Title order={3} ta="center">
                Start with a question
              </Title>
              <Text c="dimmed" size="sm" ta="center">
                Compare activities, inspect object relationships, or follow how
                attributes change. Add a visualization to start exploring.
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
              return (
                <Box key={card.id} miw={0}>
                  <AnalysisCard
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
        size="lg"
        title={editingCard ? "Edit visualization" : "Add visualization"}
        padding="lg"
        styles={{
          title: { fontWeight: 600 },
          header: {
            borderBottom: "1px solid var(--mantine-color-default-border)",
          },
          body: { paddingTop: "var(--mantine-spacing-lg)" },
        }}
      >
        {activeDefinition ? (
          <Stack gap="lg">
            {!editingCard && (
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                leftSection={<ArrowLeftIcon size={14} />}
                style={{ alignSelf: "flex-start" }}
                onClick={() => setSelectedAnalysis(null)}
              >
                All analyses
              </Button>
            )}
            <div>
              <Badge variant="light" size="sm" mb="sm">
                {activeDefinition.category}
              </Badge>
              <Title order={4}>{activeDefinition.label}</Title>
              <Text size="sm" c="dimmed" mt={4}>
                {activeDefinition.description}
              </Text>
            </div>
            <AnalysisEditor
              key={editingCard?.id ?? activeDefinition.id}
              definition={activeDefinition}
              ocelId={ocelId}
              initial={editingCard?.spec}
              onCancel={closeDrawer}
              onSubmit={saveSpec}
            />
          </Stack>
        ) : (
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Choose what you want to explore, then configure your
              visualization.
            </Text>
            <TextInput
              aria-label="Search analyses"
              placeholder="Search analyses…"
              leftSection={<SearchIcon size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            {definitionCategories
              .filter((group) => group.definitions.length > 0)
              .map(({ category, definitions }) => (
                <Stack key={category} gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                      {category}
                    </Text>
                  </Group>
                  {definitions.map((definition) => (
                    <Button
                      key={definition.id}
                      variant="default"
                      fullWidth
                      h="auto"
                      p="md"
                      radius="md"
                      styles={{
                        inner: { justifyContent: "space-between" },
                        label: {
                          display: "block",
                          // Multiline labels need room below the text baseline.
                          textBoxTrim: "none",
                          height: "auto",
                          whiteSpace: "normal",
                          textAlign: "left",
                          minWidth: 0,
                        },
                      }}
                      rightSection={
                        <ChevronRightIcon size={16} aria-hidden="true" />
                      }
                      onClick={() => setSelectedAnalysis(definition.id)}
                    >
                      <Text component="span" display="block" size="sm" fw={600}>
                        {definition.label}
                      </Text>
                      <Text
                        component="span"
                        display="block"
                        size="xs"
                        c="dimmed"
                        fw={400}
                        mt={4}
                        lh={1.5}
                      >
                        {definition.description}
                      </Text>
                    </Button>
                  ))}
                </Stack>
              ))}
            {definitionCategories.every(
              (group) => group.definitions.length === 0,
            ) && (
              <Stack align="center" gap="xs" py="xl">
                <Text fw={500}>No matching analyses</Text>
                <Text size="sm" c="dimmed">
                  Try an activity, relationship, or attribute.
                </Text>
                <Button variant="subtle" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </Drawer>
    </Container>
  );
}
