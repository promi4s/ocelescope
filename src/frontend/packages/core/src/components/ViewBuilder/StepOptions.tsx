import {
  Card,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import type { BaseStep, StepKinds, StepType } from "./types";

const MIN_CARD_WIDTH = 280;
const CARD_HEIGHT = 150;

export const StepOptions = <S extends BaseStep>({
  kinds,
  title,
  addLabel,
  searchLabel,
  noMatchLabel,
  onAdd,
}: {
  kinds: StepKinds<S>;
  title: string;
  addLabel: string;
  searchLabel: string;
  noMatchLabel: string;
  onAdd: (type: StepType<S>) => void;
}) => {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const types = (Object.keys(kinds) as StepType<S>[]).filter((type) =>
    `${kinds[type].title} ${kinds[type].description}`
      .toLowerCase()
      .includes(query),
  );

  return (
    <Stack gap="md" w="100%" flex={1} mih={0}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm" c="dimmed">
          {title}
        </Text>
        <TextInput
          size="xs"
          w={240}
          leftSection={<SearchIcon size={14} />}
          placeholder={searchLabel}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </Group>
      {types.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {noMatchLabel}
        </Text>
      ) : (
        <ScrollArea flex={1} mih={0} type="auto" scrollbarSize={6}>
          <SimpleGrid
            minColWidth={MIN_CARD_WIDTH}
            autoRows={`${CARD_HEIGHT}px`}
            spacing="md"
          >
            {types.map((type) => (
              <UnstyledButton key={type} h="100%" onClick={() => onAdd(type)}>
                <Card withBorder shadow="xs" radius="md" padding="lg" h="100%">
                  <Stack gap={6} flex={1} mih={0}>
                    <Text fw={600} truncate>
                      {kinds[type].title}
                    </Text>
                    <Text size="sm" c="dimmed" lineClamp={3} lh={1.4}>
                      {kinds[type].description}
                    </Text>
                  </Stack>
                  <Group gap={6} c="var(--mantine-primary-color-filled)">
                    <PlusIcon size={14} />
                    <Text size="xs" fw={600} c="inherit">
                      {addLabel}
                    </Text>
                  </Group>
                </Card>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </ScrollArea>
      )}
    </Stack>
  );
};
