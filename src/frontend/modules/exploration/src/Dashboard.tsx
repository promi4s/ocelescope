/** The exploration dashboard: choose a question, configure it, keep the result. */
import {
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  Clock3Icon,
  Code2Icon,
  GitBranchIcon,
  PlusIcon,
  SearchIcon,
  ShapesIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { type Analysis, analyses, findAnalysis, type Values } from "./analyses";
import { AnalysisCard } from "./Card";
import { useCards } from "./store";

export const Dashboard = ({ ocelId }: { ocelId: string }) => {
  const { cards, add, update, remove } = useCards(ocelId);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configure, setConfigure] = useState<string>();

  const addAnalysis = (analysis: string) => {
    const id = add(analysis);
    setCatalogOpen(false);
    setConfigure(id);
  };

  return (
    <Container fluid px={{ base: "sm", md: "lg" }} py="md">
      <Stack gap="lg">
        <Group align="center" justify="space-between" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs">
              <Title order={2}>Explore the log</Title>
              {cards.length > 0 && (
                <Badge variant="light" color="gray" radius="sm">
                  {cards.length} {cards.length === 1 ? "view" : "views"}
                </Badge>
              )}
            </Group>
          </Stack>
          <Button
            leftSection={<PlusIcon size={16} />}
            onClick={() => setCatalogOpen(true)}
          >
            Add visualization
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          {cards.map((card) => {
            const analysis = findAnalysis(card.analysis);
            return analysis ? (
              <AnalysisCard
                key={card.id}
                analysis={analysis}
                values={card.values}
                onChange={(values: Values) => update(card.id, values)}
                onRemove={() => remove(card.id)}
                configurationOpened={configure === card.id}
                onConfigure={() => setConfigure(card.id)}
                onCloseConfiguration={() => setConfigure(undefined)}
              />
            ) : null;
          })}
        </SimpleGrid>
      </Stack>
      <AnalysisCatalog
        opened={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAdd={addAnalysis}
      />
    </Container>
  );
};

const categoryStyle = {
  Behaviour: { color: "violet", icon: ShapesIcon },
  Relationships: { color: "blue", icon: GitBranchIcon },
  Attributes: { color: "teal", icon: SlidersHorizontalIcon },
  Time: { color: "orange", icon: Clock3Icon },
  Custom: { color: "cyan", icon: Code2Icon },
} as const;

const AnalysisCatalog = ({
  opened,
  onClose,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  onAdd: (analysis: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = [
    ...new Set(analyses.map((analysis) => analysis.category)),
  ];
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return analyses.filter(
      (analysis) =>
        (category === "All" || analysis.category === category) &&
        (!needle ||
          `${analysis.label} ${analysis.question}`
            .toLocaleLowerCase()
            .includes(needle)),
    );
  }, [category, query]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Choose a visualization"
      size="xl"
      centered
    >
      <Stack gap="md">
        <Group align="center" wrap="wrap">
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search analyses"
            leftSection={<SearchIcon size={15} />}
            style={{ flex: 1, minWidth: 220 }}
          />
          <SegmentedControl
            value={category}
            onChange={setCategory}
            data={["All", ...categories]}
          />
        </Group>
        <Divider />
        <ScrollArea.Autosize mah="62vh" type="auto" offsetScrollbars>
          {visible.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" pr="xs">
              {visible.map((analysis) => (
                <CatalogItem
                  key={analysis.id}
                  analysis={analysis}
                  onAdd={() => onAdd(analysis.id)}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No visualization matches that search.
            </Text>
          )}
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};

const CatalogItem = ({
  analysis,
  onAdd,
}: {
  analysis: Analysis;
  onAdd: () => void;
}) => {
  const visual = categoryStyle[analysis.category];
  const Icon = visual.icon;

  return (
    <UnstyledButton onClick={onAdd} style={{ height: "100%" }}>
      <Paper withBorder radius="md" p="md" h="100%">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <ThemeIcon color={visual.color} variant="light" radius="md">
              <Icon size={17} />
            </ThemeIcon>
            <Badge color={visual.color} variant="light" size="xs">
              {analysis.category}
            </Badge>
          </Group>
          <Text fw={600} size="sm">
            {analysis.label}
          </Text>
          <Text c="dimmed" size="xs" lineClamp={3}>
            {analysis.question}
          </Text>
          <Text size="xs" c={analysis.params.length > 0 ? "dimmed" : "blue"}>
            {analysis.params.length > 0
              ? `${analysis.params.length} configuration ${analysis.params.length === 1 ? "choice" : "choices"}`
              : "Ready to view"}
          </Text>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
};
