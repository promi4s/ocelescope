import {
  ActionIcon,
  Box,
  Button,
  Group,
  Popover,
  Slider,
  Stack,
  Switch,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { ActivityPicker, ObjectTypePicker } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { FilterIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useMemo, useState } from "react";
import {
  usePreviewEventCounts,
  usePreviewObjectCounts,
  usePreviewRelations,
} from "../../../api/base";
import Previewed from "../../Previewed";
import type { RelationFilter, RelationViewProps } from "./util";

const OcelTypeGraph = dynamic(
  () => import("@r4pm/components").then((m) => m.OcelTypeGraph),
  { ssr: false },
);

const eventId = (activity: string) => `event:${activity}`;
const objectId = (objectType: string) => `object:${objectType}`;

const EDGE_LIMIT = 10;

const MIN_WIDTH = 1;
const MAX_WIDTH = 6;

type Relation = Pick<RelationFilter, "source" | "target" | "qualifier">;

type Edge = {
  id: string;
  source: string;
  target: string;
  qualifier?: string;
  kind: "e2o" | "o2o";
  relation: Relation;
  sum: number;
  pair: string;
  pairSum: number;
};

const ScopePicker: React.FC<{
  label: string;
  count: number;
  total: number;
  children: ReactNode;
}> = ({ label, count, total, children }) => (
  <Group gap={4}>
    <Text size="xs" c="dimmed">
      {label}: {count} / {total}
    </Text>
    <Popover width={260} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <ActionIcon size="md" variant="transparent">
          <FilterIcon size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>{children}</Popover.Dropdown>
    </Popover>
  </Group>
);

const RelationGraph: React.FC<RelationViewProps> = ({
  ocelId,
  kind,
  filter,
  onChange,
  before,
}) => {
  const theme = useMantineTheme();
  const [showQualifiers, setShowQualifiers] = useState(true);
  const [pickedActivities, setActivities] = useState<string[] | null>(null);
  const [pickedObjectTypes, setObjectTypes] = useState<string[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [edgeLimit, setEdgeLimit] = useState(EDGE_LIMIT);

  const options = { query: { placeholderData: keepPreviousData } };
  const relations = usePreviewRelations(
    ocelId,
    kind,
    before,
    { with_qualifier: false },
    options,
  );
  const qualified = usePreviewRelations(
    ocelId,
    kind,
    before,
    { with_qualifier: true },
    options,
  );

  const events = usePreviewEventCounts(ocelId, before, options);
  const objects = usePreviewObjectCounts(ocelId, before, options);

  const graph = useMemo(() => {
    if (!relations.data || !qualified.data || !events.data || !objects.data) {
      return undefined;
    }
    const summaries = relations.data.response;
    const sourceId = kind === "e2o" ? eventId : objectId;

    const edges: Edge[] = summaries.flatMap(
      ({ source, target, sum: pairSum, qualifiers }) => {
        const rows =
          showQualifiers && (qualifiers?.length ?? 0) > 0
            ? qualified.data.response.filter(
                (row) => row.source === source && row.target === target,
              )
            : [{ qualifier: null, sum: pairSum }];
        return rows.map(({ qualifier, sum }) => ({
          id: `${kind}:${source}->${target}:${qualifier ?? ""}`,
          source: sourceId(source),
          target: objectId(target),
          qualifier: qualifier ?? undefined,
          kind,
          relation: { source, target, qualifier },
          sum,
          pair: `${source}->${target}`,
          pairSum,
        }));
      },
    );

    const activityCounts: Record<string, number> = Object.fromEntries(
      [
        ...new Set(kind === "e2o" ? summaries.map(({ source }) => source) : []),
      ].map((activity) => [activity, events.data[activity] ?? 0]),
    );
    const objectTypeCounts: Record<string, number> = Object.fromEntries(
      [
        ...new Set(
          summaries.flatMap(({ source, target }) =>
            kind === "e2o" ? [target] : [source, target],
          ),
        ),
      ].map((objectType) => [objectType, objects.data[objectType] ?? 0]),
    );

    const nodes = [
      ...Object.entries(activityCounts).map(([activity, count]) => ({
        id: eventId(activity),
        label: activity,
        kind: "event" as const,
        count,
      })),
      ...Object.entries(objectTypeCounts).map(([objectType, count]) => ({
        id: objectId(objectType),
        label: objectType,
        kind: "object" as const,
        count,
      })),
    ];

    return { nodes, edges, activityCounts, objectTypeCounts };
  }, [
    relations.data,
    qualified.data,
    events.data,
    objects.data,
    kind,
    showQualifiers,
  ]);

  const query = {
    data: graph,
    isPending:
      relations.isPending ||
      qualified.isPending ||
      events.isPending ||
      objects.isPending,
    error: relations.error ?? qualified.error ?? events.error ?? objects.error,
  };

  const select = (relation: Relation) =>
    onChange({
      ...filter,
      ...relation,
      direction: "source",
      range: [null, null],
    });

  return (
    <Previewed query={query}>
      {({ nodes, edges: allEdges, activityCounts, objectTypeCounts }) => {
        const activities = pickedActivities ?? Object.keys(activityCounts);
        const objectTypes = pickedObjectTypes ?? Object.keys(objectTypeCounts);
        const picked = new Set([
          ...activities.map(eventId),
          ...objectTypes.map(objectId),
        ]);
        const candidates = allEdges.filter(
          ({ source, target }) => picked.has(source) && picked.has(target),
        );
        const pairs = new Map(
          candidates.map(({ pair, pairSum }) => [pair, pairSum]),
        );
        const shownPairs = new Set(
          [...pairs]
            .sort(([, a], [, b]) => b - a)
            .slice(0, edgeLimit)
            .map(([pair]) => pair),
        );
        const edges = candidates.filter(({ pair }) => shownPairs.has(pair));
        const visibleNodeIds = new Set(
          edges.flatMap(({ source, target }) => [source, target]),
        );
        const shownNodes = nodes.filter(({ id }) => visibleNodeIds.has(id));
        const structure = edges
          .map(({ id }) => id)
          .sort()
          .join("|");
        const largest = Math.max(1, ...edges.map(({ sum }) => sum));
        const byId = new Map(edges.map((edge) => [edge.id, edge]));
        const neighbours = (id: string) =>
          new Set(
            edges.flatMap(({ source, target }) =>
              source === id ? [target] : target === id ? [source] : [],
            ),
          );
        const connected = pending ? neighbours(pending) : undefined;

        const clickNode = (id: string) => {
          if (!pending || pending === id) {
            setPending(pending === id ? null : id);
            return;
          }
          const candidates = edges.filter(
            ({ source, target }) =>
              (source === pending && target === id) ||
              (source === id && target === pending),
          );
          const [first] = candidates;
          if (!first) {
            setPending(id);
            return;
          }
          setPending(null);
          select({
            ...first.relation,
            qualifier:
              candidates.length === 1 ? first.relation.qualifier : null,
          });
        };

        return (
          <Stack gap="xs" flex={1} mih={0}>
            <Group justify="space-between">
              <Group gap="md">
                {kind === "e2o" && (
                  <ScopePicker
                    label="Activities"
                    count={activities.length}
                    total={Object.keys(activityCounts).length}
                  >
                    <ActivityPicker
                      ocelId={ocelId}
                      data={activityCounts}
                      variant="list"
                      multiple
                      cutoff
                      value={activities}
                      onChange={(next) => setActivities([...next])}
                    />
                  </ScopePicker>
                )}
                <ScopePicker
                  label="Object types"
                  count={objectTypes.length}
                  total={Object.keys(objectTypeCounts).length}
                >
                  <ObjectTypePicker
                    ocelId={ocelId}
                    data={objectTypeCounts}
                    variant="list"
                    multiple
                    cutoff
                    value={objectTypes}
                    onChange={(next) => setObjectTypes([...next])}
                  />
                </ScopePicker>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    Relations: top {Math.min(edgeLimit, pairs.size)} of{" "}
                    {pairs.size}
                  </Text>
                  <Slider
                    w={140}
                    size="sm"
                    min={1}
                    max={Math.max(1, pairs.size)}
                    value={Math.min(edgeLimit, Math.max(1, pairs.size))}
                    onChange={setEdgeLimit}
                  />
                </Group>
                <Switch
                  size="xs"
                  label="Qualifiers"
                  checked={showQualifiers}
                  onChange={(event) =>
                    setShowQualifiers(event.currentTarget.checked)
                  }
                />
              </Group>
              {pending ? (
                <Button
                  size="compact-xs"
                  variant="light"
                  rightSection={<XIcon size={12} />}
                  onClick={() => setPending(null)}
                >
                  {pending.slice(pending.indexOf(":") + 1)}: pick the second
                  node
                </Button>
              ) : (
                <Text size="xs" c="dimmed">
                  Click an edge, or two nodes, to pick a relation
                </Text>
              )}
            </Group>
            <Box flex={1} mih={420} pos="relative">
              <OcelTypeGraph
                key={structure}
                nodes={shownNodes}
                edges={edges}
                nodeRingColor={(id) =>
                  id === pending ? theme.colors.blue[6] : undefined
                }
                nodeDimmed={(id) =>
                  connected !== undefined &&
                  id !== pending &&
                  !connected.has(id)
                }
                edgeStyle={(id) => {
                  const edge = byId.get(id);
                  return edge
                    ? {
                        width:
                          MIN_WIDTH +
                          (MAX_WIDTH - MIN_WIDTH) * (edge.sum / largest),
                      }
                    : undefined;
                }}
                onNodeClick={clickNode}
                onEdgeClick={(id) => {
                  const edge = byId.get(id);
                  if (edge) {
                    select(edge.relation);
                  }
                }}
              />
            </Box>
          </Stack>
        );
      }}
    </Previewed>
  );
};

export default RelationGraph;
