import {
  Box,
  Group,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  useMantineTheme,
} from "@mantine/core";
import {
  type RelationCountSummary,
  useE2o,
  useEventCounts,
  useO2o,
  useObjectCounts,
} from "@ocelescope/api-base";
import type {
  OcelTypeGraphEdge,
  OcelTypeGraphNode,
  OcelTypeGraphProps,
} from "@r4pm/components";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { viewParams } from "../ViewBuilder/util";
import type {
  RelationGraphInputProps,
  RelationGraphKind,
  RelationGraphMode,
  RelationGraphValue,
} from "./types";

const OcelTypeGraph = dynamic(
  async () => {
    const [{ OcelTypeGraph: Graph }, { wasmViz }] = await Promise.all([
      import("@r4pm/components"),
      import("@r4pm/components/viz/wasm"),
    ]);
    return (props: OcelTypeGraphProps) => <Graph viz={wasmViz} {...props} />;
  },
  { ssr: false },
);

const ScopePicker = dynamic(() => import("./ScopePicker"), { ssr: false });

const EDGE_LIMIT = 10;

const KIND_OPTIONS = [
  { label: "E2O", value: "e2o" },
  { label: "O2O", value: "o2o" },
  { label: "Both", value: "both" },
];

const eventId = (activity: string) => `event:${activity}`;
const objectId = (objectType: string) => `object:${objectType}`;
const edgeId = (kind: RelationGraphKind, row: RelationCountSummary) =>
  `${kind}:${row.source}->${row.target}:${row.qualifier}`;

const countsOf = (names: string[], counts: Record<string, number> = {}) =>
  Object.fromEntries(names.map((name) => [name, counts[name] ?? 0]));

const toGraph = (
  kind: RelationGraphKind,
  rows: RelationCountSummary[],
  qualified: boolean,
) => {
  const sourceId = kind === "e2o" ? eventId : objectId;
  const nodes = rows.flatMap((row): OcelTypeGraphNode[] => [
    {
      id: sourceId(row.source),
      label: row.source,
      kind: kind === "e2o" ? "event" : "object",
    },
    { id: objectId(row.target), label: row.target, kind: "object" },
  ]);
  const edges = rows.map(
    (row): OcelTypeGraphEdge => ({
      id: edgeId(kind, row),
      source: sourceId(row.source),
      target: objectId(row.target),
      qualifier: row.qualifier || undefined,
    }),
  );
  const values = rows.map((row): [string, RelationGraphValue] => [
    edgeId(kind, row),
    {
      source: row.source,
      target: row.target,
      qualifier: (qualified && row.qualifier) || null,
    },
  ]);
  return { nodes, edges, values };
};

const RelationGraphInput: React.FC<RelationGraphInputProps> = ({
  ocelId,
  viewId,
  mode,
  value,
  onChange,
}) => {
  const [pickedActivities, setActivities] = useState<string[] | null>(null);
  const [pickedObjectTypes, setObjectTypes] = useState<string[] | null>(null);
  const [edgeLimit, setEdgeLimit] = useState(EDGE_LIMIT);
  const [focused, setFocused] = useState<string | null>(null);
  const [shown, setShown] = useState<RelationGraphMode>("both");
  const [showQualifiers, setShowQualifiers] = useState(true);
  const active = mode === "both" ? shown : mode;
  const theme = useMantineTheme();

  const view = viewParams(viewId);
  const relationParams = { ...view, with_qualifier: showQualifiers };
  const e2o = useE2o(ocelId, relationParams, {
    query: { enabled: active !== "o2o" },
  });
  const o2o = useO2o(ocelId, relationParams, {
    query: { enabled: active !== "e2o" },
  });
  const events = useEventCounts(ocelId, view, {
    query: { enabled: active !== "o2o" },
  });
  const objects = useObjectCounts(ocelId, view);

  const e2oRows = useMemo(
    () => (active !== "o2o" ? (e2o.data?.response ?? []) : []),
    [active, e2o.data],
  );
  const o2oRows = useMemo(
    () => (active !== "e2o" ? (o2o.data?.response ?? []) : []),
    [active, o2o.data],
  );

  const activityCounts = useMemo(
    () =>
      countsOf([...new Set(e2oRows.map(({ source }) => source))], events.data),
    [e2oRows, events.data],
  );
  const objectTypeCounts = useMemo(
    () =>
      countsOf(
        [
          ...new Set([
            ...e2oRows.map(({ target }) => target),
            ...o2oRows.flatMap(({ source, target }) => [source, target]),
          ]),
        ],
        objects.data,
      ),
    [e2oRows, o2oRows, objects.data],
  );

  const activities = useMemo(
    () => pickedActivities ?? Object.keys(activityCounts),
    [pickedActivities, activityCounts],
  );
  const objectTypes = useMemo(
    () => pickedObjectTypes ?? Object.keys(objectTypeCounts),
    [pickedObjectTypes, objectTypeCounts],
  );

  const scoped = useMemo(
    () => ({
      e2o: e2oRows.filter(
        (row) =>
          activities.includes(row.source) && objectTypes.includes(row.target),
      ),
      o2o: o2oRows.filter(
        (row) =>
          objectTypes.includes(row.source) && objectTypes.includes(row.target),
      ),
    }),
    [e2oRows, o2oRows, activities, objectTypes],
  );
  const total = scoped.e2o.length + scoped.o2o.length;

  const graph = useMemo(() => {
    const threshold =
      [...scoped.e2o, ...scoped.o2o]
        .map(({ sum }) => sum)
        .sort((a, b) => b - a)[edgeLimit - 1] ?? 0;
    const parts = [
      toGraph(
        "e2o",
        scoped.e2o.filter(({ sum }) => sum >= threshold),
        showQualifiers,
      ),
      toGraph(
        "o2o",
        scoped.o2o.filter(({ sum }) => sum >= threshold),
        showQualifiers,
      ),
    ];
    const nodes = new Map(
      parts.flatMap(({ nodes }) => nodes).map((node) => [node.id, node]),
    );
    return {
      nodes: [...nodes.values()],
      edges: parts.flatMap(({ edges }) => edges),
      values: new Map(parts.flatMap(({ values }) => values)),
    };
  }, [scoped, edgeLimit, showQualifiers]);

  const neighbours = useMemo(() => {
    if (focused === null) {
      return null;
    }
    return new Set(
      graph.edges.flatMap(({ source, target }) =>
        source === focused ? [target] : target === focused ? [source] : [],
      ),
    );
  }, [graph.edges, focused]);
  const edgesById = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges],
  );

  const picked = useMemo(() => {
    const edges = graph.edges.filter(({ id }) => {
      const relation = graph.values.get(id);
      return (
        value !== null &&
        relation !== undefined &&
        relation.source === value.source &&
        relation.target === value.target &&
        (!value.qualifier ||
          relation.qualifier === null ||
          relation.qualifier === value.qualifier)
      );
    });
    return {
      edges: new Set(edges.map(({ id }) => id)),
      nodes: new Set(edges.flatMap(({ source, target }) => [source, target])),
    };
  }, [graph, value]);

  const pickBetween = (first: string, second: string) => {
    const between = graph.edges.filter(
      ({ source, target }) =>
        (source === first && target === second) ||
        (source === second && target === first),
    );
    const forward = between.filter(({ source }) => source === first);
    const chosen = forward.length > 0 ? forward : between;
    const values = chosen.flatMap(({ id }) => graph.values.get(id) ?? []);
    const [value] = values;
    if (value) {
      onChange(values.length === 1 ? value : { ...value, qualifier: null });
    }
  };

  const clickNode = (id: string) => {
    if (focused === null || id === focused) {
      setFocused(id === focused ? null : id);
      if (value !== null) {
        onChange(null);
      }
      return;
    }
    if (neighbours?.has(id)) {
      pickBetween(focused, id);
      setFocused(null);
      return;
    }
    setFocused(id);
  };

  return (
    <Stack gap="xs" flex={1} mih={0}>
      <Group justify="space-between">
        <Group gap="md">
          {active !== "o2o" && (
            <ScopePicker
              label="Activities"
              colorScope="activity"
              counts={activityCounts}
              value={activities}
              onChange={setActivities}
            />
          )}
          <ScopePicker
            label="Object types"
            colorScope="objectType"
            counts={objectTypeCounts}
            value={objectTypes}
            onChange={setObjectTypes}
          />
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Relations: top {Math.min(edgeLimit, total)} of {total}
            </Text>
            <Slider
              w={140}
              size="sm"
              min={1}
              max={Math.max(1, total)}
              value={Math.min(edgeLimit, Math.max(1, total))}
              onChange={setEdgeLimit}
            />
          </Group>
          <Switch
            size="xs"
            label="Qualifiers"
            checked={showQualifiers}
            onChange={(event) => {
              setFocused(null);
              setShowQualifiers(event.currentTarget.checked);
            }}
          />
        </Group>
        <div>
          {mode === "both" && (
            <SegmentedControl
              size="xs"
              value={shown}
              data={KIND_OPTIONS}
              onChange={(next) => {
                setFocused(null);
                setShown(next as RelationGraphMode);
              }}
            />
          )}
        </div>
      </Group>
      <Box flex={1} mih={420} pos="relative">
        <OcelTypeGraph
          nodes={graph.nodes}
          edges={graph.edges}
          nodeRingColor={(id) =>
            id === focused || picked.nodes.has(id)
              ? theme.colors.blue[6]
              : undefined
          }
          nodeDimmed={(id) =>
            neighbours !== null && id !== focused && !neighbours.has(id)
          }
          edgeStyle={(id) => {
            const edge = edgesById.get(id);
            if (!edge) {
              return undefined;
            }
            return {
              color: picked.edges.has(id) ? theme.colors.blue[6] : undefined,
              dimmed:
                focused !== null &&
                edge.source !== focused &&
                edge.target !== focused,
            };
          }}
          onNodeClick={clickNode}
          onEdgeClick={(id) => {
            const value = graph.values.get(id);
            if (value) {
              setFocused(null);
              onChange(picked.edges.has(id) ? null : value);
            }
          }}
        />
      </Box>
    </Stack>
  );
};

export default RelationGraphInput;
