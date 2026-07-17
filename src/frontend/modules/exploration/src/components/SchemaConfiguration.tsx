import {
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  LoadingOverlay,
  NavLink,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useInvalidate } from "@ocelescope/core";
import {
  ActivityIcon,
  BoxIcon,
  CheckIcon,
  DatabaseIcon,
  InfoIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type AnalyticalSchemaResponse,
  type AttributeClassificationOverrideScope,
  type AttributeSchemaItem,
  type ObjectAttributeSchemaItem,
  useGetAnalyticalSchema,
  useUpdateAnalyticalSchema,
} from "../api/querying";
import {
  type AnalyticalType,
  supportedAnalyticalTypes,
} from "../lib/analyticalCapabilities";

import { AnalyticalTypeBadge, AttributeTypeBadge } from "./AttributeTypeBadge";

type SchemaAttribute = AttributeSchemaItem | ObjectAttributeSchemaItem;

interface SchemaEntity {
  name: string;
  count: number;
  countLabel: string;
  attributes: SchemaAttribute[];
}

interface SchemaRow {
  scope: AttributeClassificationOverrideScope;
  entityType: string;
  attribute: SchemaAttribute;
}

const analyticalTypeLabels: Record<AnalyticalType, string> = {
  categorical: "Categorical",
  discrete: "Numerical · Discrete",
  continuous: "Numerical · Continuous",
  temporal: "Temporal",
  unknown: "Unknown scale",
};

const rowKey = (
  scope: AttributeClassificationOverrideScope,
  entityType: string,
  attribute: string,
) => JSON.stringify([scope, entityType, attribute]);

const isObjectAttribute = (
  attribute: SchemaAttribute,
): attribute is ObjectAttributeSchemaItem => "behavior" in attribute;

function schemaRows(schema: AnalyticalSchemaResponse): SchemaRow[] {
  return [
    ...schema.activities.flatMap((activity) =>
      activity.attributes.map((attribute) => ({
        scope: "event" as const,
        entityType: activity.name,
        attribute,
      })),
    ),
    ...schema.object_types.flatMap((objectType) =>
      objectType.attributes.map((attribute) => ({
        scope: "object" as const,
        entityType: objectType.name,
        attribute,
      })),
    ),
  ];
}

function schemaDraft(schema: AnalyticalSchemaResponse) {
  return Object.fromEntries(
    schemaRows(schema).map(({ scope, entityType, attribute }) => [
      rowKey(scope, entityType, attribute.name),
      attribute.analytical_type,
    ]),
  ) as Record<string, AnalyticalType>;
}

function ObjectLifecycle({
  attribute,
}: {
  attribute: ObjectAttributeSchemaItem;
}) {
  return (
    <Stack gap={7}>
      <Group justify="space-between">
        <Text size="xs" fw={600}>
          Object lifecycle
        </Text>
        <Badge
          size="xs"
          color={attribute.behavior === "dynamic" ? "blue" : "gray"}
          variant="light"
        >
          {attribute.behavior}
        </Badge>
      </Group>
      <Grid columns={2} gap={6}>
        <Grid.Col span={1}>
          <Text size="xs" c="dimmed">
            {attribute.initial_present_count.toLocaleString()} initially present
          </Text>
        </Grid.Col>
        <Grid.Col span={1}>
          <Text size="xs" c="dimmed">
            {attribute.current_present_count.toLocaleString()} currently present
          </Text>
        </Grid.Col>
        <Grid.Col span={1}>
          <Text size="xs" c="dimmed">
            {attribute.change_count.toLocaleString()} changes
          </Text>
        </Grid.Col>
        <Grid.Col span={1}>
          <Text size="xs" c="dimmed">
            {attribute.changed_object_count.toLocaleString()} changed objects
          </Text>
        </Grid.Col>
      </Grid>
      <Text size="xs" c="dimmed">
        {attribute.observed_value_count.toLocaleString()} observed value records
      </Text>
    </Stack>
  );
}

function AttributeEditor({
  scope,
  entityName,
  attribute,
  selected,
  onChange,
}: {
  scope: AttributeClassificationOverrideScope;
  entityName: string;
  attribute: SchemaAttribute;
  selected: AnalyticalType;
  onChange: (value: AnalyticalType) => void;
}) {
  const inferred = attribute.inferred_analytical_type;
  const effective = attribute.analytical_type;
  const changed = selected !== effective;
  const overridden = selected !== inferred;
  const total = attribute.present_count + attribute.missing_count;
  const presentPercent =
    total === 0 ? 0 : (attribute.present_count / total) * 100;

  return (
    <Paper
      withBorder
      radius="md"
      p="lg"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: changed
          ? "var(--mantine-color-yellow-6)"
          : overridden
            ? "var(--mantine-color-blue-5)"
            : "var(--mantine-color-gray-3)",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Group gap="xs">
              <Text fw={650}>{attribute.name}</Text>
              <AttributeTypeBadge dataType={attribute.physical_type} />
              {isObjectAttribute(attribute) && (
                <Badge
                  size="sm"
                  variant="outline"
                  color={attribute.behavior === "dynamic" ? "blue" : "gray"}
                >
                  {attribute.behavior}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {scope === "event" ? "Event attribute" : "Object attribute"} of{" "}
              {entityName}
            </Text>
          </Stack>
          {changed ? (
            <Badge color="yellow" variant="light">
              Unsaved change
            </Badge>
          ) : overridden ? (
            <Badge color="blue" variant="light">
              Overridden
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              Inferred
            </Badge>
          )}
        </Group>

        <Divider />

        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="sm">
              <Select
                label="Analytical interpretation"
                description="Controls how values are grouped and measured."
                data={supportedAnalyticalTypes(attribute.physical_type).map(
                  (item) => ({
                    value: item,
                    label: analyticalTypeLabels[item],
                  }),
                )}
                value={selected}
                onChange={(value) =>
                  onChange((value ?? inferred) as AnalyticalType)
                }
                allowDeselect={false}
                renderOption={({ option }) => (
                  <Group justify="space-between" wrap="nowrap" w="100%">
                    <Text size="sm">{option.label}</Text>
                    <AnalyticalTypeBadge
                      analyticalType={option.value as AnalyticalType}
                    />
                  </Group>
                )}
              />

              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Inferred:
                </Text>
                <AnalyticalTypeBadge analyticalType={inferred} />
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="lg">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="xs" fw={600}>
                    {scope === "event" ? "Value coverage" : "Current coverage"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {presentPercent.toFixed(1)}% present
                  </Text>
                </Group>
                <Progress value={presentPercent} size="sm" radius="xl" />
                <Group gap="lg">
                  <Text size="xs" c="dimmed">
                    {attribute.present_count.toLocaleString()} present
                  </Text>
                  <Text size="xs" c="dimmed">
                    {attribute.missing_count.toLocaleString()} missing
                  </Text>
                  <Text size="xs" c="dimmed">
                    {attribute.distinct_count.toLocaleString()} distinct
                  </Text>
                </Group>
              </Stack>

              {isObjectAttribute(attribute) && (
                <ObjectLifecycle attribute={attribute} />
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
}

function EntityNavigation({
  scope,
  entities,
  selected,
  onSelect,
}: {
  scope: AttributeClassificationOverrideScope;
  entities: SchemaEntity[];
  selected?: string;
  onSelect: (entity: string) => void;
}) {
  const Icon = scope === "event" ? ActivityIcon : BoxIcon;
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Group px="md" py="sm" gap="xs">
        <Icon size={16} />
        <Text size="sm" fw={650}>
          {scope === "event" ? "Activities" : "Object types"}
        </Text>
      </Group>
      <Divider />
      <ScrollArea.Autosize mah={620}>
        <Stack gap={2} p="xs">
          {entities.map((entity) => (
            <NavLink
              key={entity.name}
              active={entity.name === selected}
              label={entity.name}
              description={`${entity.count.toLocaleString()} ${entity.countLabel}`}
              rightSection={
                <Badge size="sm" variant="default" circle>
                  {entity.attributes.length}
                </Badge>
              }
              onClick={() => onSelect(entity.name)}
              style={{ borderRadius: "var(--mantine-radius-sm)" }}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

export function SchemaConfiguration({ ocelId }: { ocelId: string }) {
  const schema = useGetAnalyticalSchema(ocelId);
  const invalidate = useInvalidate();
  const [scope, setScope] =
    useState<AttributeClassificationOverrideScope>("event");
  const [draft, setDraft] = useState<Record<string, AnalyticalType>>({});
  const [search, setSearch] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<
    Partial<Record<AttributeClassificationOverrideScope, string>>
  >({});

  useEffect(() => {
    if (!schema.data) return;
    setDraft(schemaDraft(schema.data));
    setSelectedEntities((current) => ({
      event: schema.data?.activities.some((item) => item.name === current.event)
        ? current.event
        : schema.data?.activities[0]?.name,
      object: schema.data?.object_types.some(
        (item) => item.name === current.object,
      )
        ? current.object
        : schema.data?.object_types[0]?.name,
    }));
  }, [schema.data]);

  const update = useUpdateAnalyticalSchema({
    mutation: {
      onSuccess: async () => {
        await invalidate(["ocels"]);
      },
    },
  });

  const rows = useMemo(
    () => (schema.data ? schemaRows(schema.data) : []),
    [schema.data],
  );
  const entities = useMemo<SchemaEntity[]>(
    () =>
      scope === "event"
        ? (schema.data?.activities ?? []).map((activity) => ({
            name: activity.name,
            count: activity.event_count,
            countLabel: "events",
            attributes: activity.attributes,
          }))
        : (schema.data?.object_types ?? []).map((objectType) => ({
            name: objectType.name,
            count: objectType.object_count,
            countLabel: "objects",
            attributes: objectType.attributes,
          })),
    [schema.data, scope],
  );
  const query = search.trim().toLocaleLowerCase();
  const visibleEntities = useMemo(
    () =>
      entities
        .map((entity) => {
          const entityMatches = entity.name.toLocaleLowerCase().includes(query);
          return {
            ...entity,
            attributes: entityMatches
              ? entity.attributes
              : entity.attributes.filter(
                  (attribute) =>
                    !query ||
                    attribute.name.toLocaleLowerCase().includes(query) ||
                    attribute.analytical_type.includes(query) ||
                    attribute.physical_type.includes(query),
                ),
          };
        })
        .filter((entity) => entity.attributes.length > 0),
    [entities, query],
  );
  const activeEntity =
    visibleEntities.find((entity) => entity.name === selectedEntities[scope]) ??
    visibleEntities[0];

  if (schema.error) {
    return (
      <Container size="xl">
        <Alert color="red" title="Unable to load the analytical schema">
          {String(schema.error)}
        </Alert>
      </Container>
    );
  }
  if (!schema.data) return <LoadingOverlay visible />;

  const dirtyCount = rows.filter(
    ({ scope: rowScope, entityType, attribute }) => {
      const value = draft[rowKey(rowScope, entityType, attribute.name)];
      return value !== attribute.analytical_type;
    },
  ).length;
  const configuredCount = rows.filter(
    ({ scope: rowScope, entityType, attribute }) => {
      const value = draft[rowKey(rowScope, entityType, attribute.name)];
      return value !== attribute.inferred_analytical_type;
    },
  ).length;
  const eventAttributeCount = rows.filter(
    (row) => row.scope === "event",
  ).length;
  const objectAttributeCount = rows.length - eventAttributeCount;

  const save = () => {
    update.mutate({
      ocelId,
      data: {
        overrides: rows.flatMap(
          ({ scope: rowScope, entityType, attribute }) => {
            const analyticalType =
              draft[rowKey(rowScope, entityType, attribute.name)] ??
              attribute.inferred_analytical_type;
            return analyticalType === attribute.inferred_analytical_type
              ? []
              : [
                  {
                    scope: rowScope,
                    entity_type: entityType,
                    attribute: attribute.name,
                    analytical_type: analyticalType,
                  },
                ];
          },
        ),
      },
    });
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Group gap="xs">
              <ThemeIcon variant="light" radius="md">
                <DatabaseIcon size={17} />
              </ThemeIcon>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
                Exploration configuration
              </Text>
            </Group>
            <Title order={2}>Analytical schema</Title>
            <Text c="dimmed" size="sm" maw={680}>
              Configure how event and object attributes are interpreted across
              analytical queries.
            </Text>
          </Stack>

          <Group>
            <Button
              variant="default"
              leftSection={<RotateCcwIcon size={15} />}
              disabled={configuredCount === 0 || update.isPending}
              onClick={() => {
                update.reset();
                setDraft(
                  Object.fromEntries(
                    rows.map(({ scope: rowScope, entityType, attribute }) => [
                      rowKey(rowScope, entityType, attribute.name),
                      attribute.inferred_analytical_type,
                    ]),
                  ),
                );
              }}
            >
              Restore inferred
            </Button>
            <Button
              leftSection={<SaveIcon size={15} />}
              disabled={dirtyCount === 0}
              loading={update.isPending}
              onClick={save}
            >
              Save{dirtyCount > 0 ? ` ${dirtyCount} changes` : ""}
            </Button>
          </Group>
        </Group>

        <Group gap="xs">
          <Badge variant="default" leftSection={<ActivityIcon size={11} />}>
            {eventAttributeCount} event attributes
          </Badge>
          <Badge variant="default" leftSection={<BoxIcon size={11} />}>
            {objectAttributeCount} object attributes
          </Badge>
          <Badge
            variant={configuredCount > 0 ? "light" : "default"}
            color={configuredCount > 0 ? "blue" : "gray"}
            leftSection={<CheckIcon size={11} />}
          >
            {configuredCount} overrides
          </Badge>
          <Tooltip label="The schema uses the full OCEL and is unaffected by log filters.">
            <Badge variant="transparent" color="gray">
              <InfoIcon size={13} />
            </Badge>
          </Tooltip>
        </Group>

        {update.error && (
          <Alert color="red" title="Unable to save the schema">
            {String(update.error)}
          </Alert>
        )}
        {update.isSuccess && dirtyCount === 0 && (
          <Alert color="green" title="Schema saved" variant="light">
            The configured interpretations are now active.
          </Alert>
        )}

        <SegmentedControl
          value={scope}
          onChange={(value) => {
            setScope(value as AttributeClassificationOverrideScope);
            setSearch("");
          }}
          data={[
            { value: "event", label: "Event attributes" },
            { value: "object", label: "Object attributes" },
          ]}
          fullWidth
        />

        <TextInput
          leftSection={<SearchIcon size={16} />}
          placeholder={`Search ${scope === "event" ? "activities" : "object types"}, attributes, or types`}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        <Grid gap="lg" align="flex-start">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <EntityNavigation
              scope={scope}
              entities={visibleEntities}
              selected={activeEntity?.name}
              onSelect={(entity) =>
                setSelectedEntities((current) => ({
                  ...current,
                  [scope]: entity,
                }))
              }
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 9 }}>
            {activeEntity ? (
              <Stack gap="md">
                <Group justify="space-between">
                  <Stack gap={1}>
                    <Text fw={650}>{activeEntity.name}</Text>
                    <Text size="xs" c="dimmed">
                      {activeEntity.count.toLocaleString()}{" "}
                      {activeEntity.countLabel}
                      {" · "}
                      {activeEntity.attributes.length} attributes
                    </Text>
                  </Stack>
                  <Badge variant="light">
                    {scope === "event" ? "Event activity" : "Object type"}
                  </Badge>
                </Group>

                {activeEntity.attributes.map((attribute) => {
                  const key = rowKey(scope, activeEntity.name, attribute.name);
                  return (
                    <AttributeEditor
                      key={attribute.name}
                      scope={scope}
                      entityName={activeEntity.name}
                      attribute={attribute}
                      selected={draft[key] ?? attribute.analytical_type}
                      onChange={(value) => {
                        update.reset();
                        setDraft((current) => ({
                          ...current,
                          [key]: value,
                        }));
                      }}
                    />
                  );
                })}
              </Stack>
            ) : (
              <Paper withBorder radius="md" p="xl">
                <Stack align="center" gap="xs">
                  <SearchIcon size={22} />
                  <Text fw={600}>No matching schema entries</Text>
                  <Text size="sm" c="dimmed">
                    Try a different search term.
                  </Text>
                </Stack>
              </Paper>
            )}
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
