import {
  ActionIcon,
  Box,
  Group,
  LoadingOverlay,
  Popover,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import {
  useE2OCount,
  useEventCounts,
  useO2OCount,
  useObjectCounts,
} from "@ocelescope/api-base";
import { ActivityPicker, ObjectTypePicker } from "@ocelescope/core";
import { FilterIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useMemo, useState } from "react";

const R4PMOcelTypeGraph = dynamic(
  () => import("@r4pm/components").then((m) => m.OcelTypeGraph),
  { ssr: false },
);

type EdgeClickEvent = { source: string; target: string; type: "e2o" | "o2o" };

type OcelTypeGraphProps = {
  ocelId: string;
  onEdgeClick?: (event: EdgeClickEvent) => void;
};

const objectId = (otype: string) => `object:${otype}`;
const activityId = (activity: string) => `activity:${activity}`;

const topHalf = (counts: Record<string, number> | undefined) => {
  const types = Object.entries(counts ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type);
  return types.slice(0, Math.max(1, Math.ceil(types.length / 2)));
};

const PickerPopover = ({
  label,
  count,
  total,
  children,
}: {
  label: string;
  count: number;
  total: number;
  children: ReactNode;
}) => (
  <Group gap={4}>
    <Text size="xs" c={"dimmed"}>
      {label}: {count} / {total}
    </Text>
    <Popover
      width={200}
      position="bottom"
      withArrow
      shadow="md"
      clickOutsideEvents={["pointerdown"]}
    >
      <Popover.Target>
        <ActionIcon size={"md"} variant="transparent">
          <FilterIcon size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>{children}</Popover.Dropdown>
    </Popover>
  </Group>
);

export const OcelTypeGraph = ({ ocelId, onEdgeClick }: OcelTypeGraphProps) => {
  const { data: e2o, isLoading: isE2OLoading } = useE2OCount(ocelId, {
    ocel_version: "original",
  });

  const { data: o2o, isLoading: isO2OLoading } = useO2OCount(ocelId, {
    ocel_version: "original",
  });

  const [frequency, setFrequency] = useState(50);
  const { data: objectCounts } = useObjectCounts(ocelId, {
    ocel_version: "original",
  });
  const { data: eventCounts } = useEventCounts(ocelId, {
    ocel_version: "original",
  });

  const [pickedObjectTypes, setObjectTypes] = useState<string[] | null>(null);
  const [pickedActivities, setActivities] = useState<string[] | null>(null);
  const objectTypes = useMemo(
    () => pickedObjectTypes ?? topHalf(objectCounts),
    [pickedObjectTypes, objectCounts],
  );
  const activities = useMemo(
    () => pickedActivities ?? topHalf(eventCounts),
    [pickedActivities, eventCounts],
  );

  const edges = useMemo(() => {
    const e2oEdges = (e2o ?? []).map(({ source, target, count }) => ({
      id: `e2o:${source}-${target}`,
      source: activityId(source),
      target: objectId(target),
      kind: "e2o" as const,
      count,
    }));

    const o2oEdges = (o2o ?? []).map(({ source, target, count }) => ({
      id: `o2o:${source}-${target}`,
      source: objectId(source),
      target: objectId(target),
      kind: "o2o" as const,
      count,
    }));

    return [...e2oEdges, ...o2oEdges];
  }, [e2o, o2o]);

  const nodes = useMemo(() => {
    const activityNodes = Array.from(
      new Set((e2o ?? []).map(({ source }) => source)),
    ).map((activity) => ({
      id: activityId(activity),
      label: activity,
      kind: "event" as const,
    }));

    const objectNodes = Array.from(
      new Set([
        ...(o2o ?? []).flatMap(({ source, target }) => [source, target]),
        ...(e2o ?? []).map(({ target }) => target),
      ]),
    ).map((otype) => ({
      id: objectId(otype),
      label: otype,
      kind: "object" as const,
    }));

    return [...objectNodes, ...activityNodes];
  }, [e2o, o2o]);

  const frequentEdges = useMemo(() => {
    const topPercent = (kindEdges: typeof edges) => {
      if (kindEdges.length === 0) return [];
      const keep = Math.max(1, Math.ceil((kindEdges.length * frequency) / 100));
      return [...kindEdges].sort((a, b) => b.count - a.count).slice(0, keep);
    };

    return [
      ...topPercent(edges.filter(({ kind }) => kind === "e2o")),
      ...topPercent(edges.filter(({ kind }) => kind === "o2o")),
    ];
  }, [edges, frequency]);

  const visibleNodeIds = useMemo(() => {
    const includedObjectTypeIds =
      objectTypes.length > 0 ? new Set(objectTypes.map(objectId)) : undefined;
    const includedActivityIds =
      activities.length > 0 ? new Set(activities.map(activityId)) : undefined;
    const pickedIds = new Set(
      nodes
        .filter(({ kind, id }) => {
          const included =
            kind === "event" ? includedActivityIds : includedObjectTypeIds;
          return !included || included.has(id);
        })
        .map(({ id }) => id),
    );

    const connectedIds = new Set(
      frequentEdges
        .filter(
          ({ source, target }) =>
            pickedIds.has(source) && pickedIds.has(target),
        )
        .flatMap(({ source, target }) => [source, target]),
    );

    return nodes.filter(({ id }) => connectedIds.has(id)).map(({ id }) => id);
  }, [objectTypes, activities, frequentEdges, nodes]);

  const isLoading = isE2OLoading || isO2OLoading;

  return (
    <Stack h={"100%"} gap={0}>
      <Group>
        <Group gap={"xs"}>
          <Text size="xs" c={"dimmed"}>
            Frequency:
          </Text>
          <Slider
            value={frequency}
            min={1}
            max={100}
            label={(value) => `Top ${value}%`}
            onChange={setFrequency}
            w={100}
          />
        </Group>
        <PickerPopover
          label="Activities"
          count={activities.length}
          total={Object.keys(eventCounts ?? {}).length}
        >
          <ActivityPicker
            value={activities}
            multiple
            variant="list"
            cutoff
            ocelId={ocelId}
            ocelVersion="original"
            onChange={(next) => setActivities(Array.from(next))}
          />
        </PickerPopover>
        <PickerPopover
          label="Object Types"
          count={objectTypes.length}
          total={Object.keys(objectCounts ?? {}).length}
        >
          <ObjectTypePicker
            value={objectTypes}
            multiple
            variant="list"
            cutoff
            ocelId={ocelId}
            ocelVersion="original"
            onChange={(next) => setObjectTypes(Array.from(next))}
          />
        </PickerPopover>
      </Group>
      <Box pos={"relative"} flex={1}>
        {isLoading ? (
          <LoadingOverlay visible />
        ) : (
          <R4PMOcelTypeGraph
            key={`${visibleNodeIds.join(",")}|${frequentEdges.length}`}
            edges={frequentEdges}
            nodes={nodes}
            visibleNodeIds={visibleNodeIds}
            {...(onEdgeClick && {
              onEdgeClick: (clickedId) => {
                const edge = edges.find(({ id }) => clickedId === id);
                if (edge) {
                  onEdgeClick({ ...edge, type: edge.kind });
                }
              },
            })}
          />
        )}
      </Box>
    </Stack>
  );
};
