import {
  Group,
  Input,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDebouncedState } from "@mantine/hooks";
import {
  useO2o,
  useObjectAttributes,
  useObjectCounts,
} from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { MarkerType } from "@xyflow/react";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import EntityCard from "../components/EntityCard";
import EntityOverview from "../components/EntityOverview";
import Graph, { type NodeComponents } from "../components/Graph";

const ObjectGraph = () => {
  const { id: ocelId } = useCurrentOcel();
  const { data: o2o } = useO2o(ocelId);
  const { data: objectAttributes = [] } = useObjectAttributes(ocelId);
  const { data: objectCounts } = useObjectCounts(ocelId);

  const [searchValue, setSearchValue] = useDebouncedState("", 200);
  const [visualization, setVisualization] = useState<"graph" | "cards">(
    "graph",
  );

  const nodes = useMemo(() => {
    if (!objectCounts || !objectAttributes) return [];

    return Object.entries(objectCounts).map(
      ([objectName, count]) =>
        ({
          id: objectName,
          data: {
            type: "rectangle",
            inner: (
              <EntityCard
                key={objectName}
                count={count}
                name={objectName}
                maw={300}
                attributeSummaries={objectAttributes.filter(
                  ({ entity_type }) => entity_type === objectName,
                )}
              />
            ),
          },
        }) satisfies NodeComponents,
    );
  }, [objectCounts, objectAttributes]);

  return (
    <Stack w={"100%"} h={"100%"}>
      <Title order={2}>Object Overview</Title>
      <Text c="dimmed" size="sm">
        Get an overview of all object types in this log. Switch between an
        interactive graph and a card grid to see how many objects of each type
        exist, what attributes they have, and how they relate to one another.
      </Text>
      <Group justify="end">
        {visualization === "cards" && (
          <Input
            leftSection={<SearchIcon />}
            defaultValue={searchValue}
            onChange={(newSearch) => setSearchValue(newSearch.target.value)}
          />
        )}
        <SegmentedControl
          onChange={(newViz) =>
            setVisualization(newViz as typeof visualization)
          }
          value={visualization}
          data={[
            { label: "Graph", value: "graph" },
            { label: "Cards", value: "cards" },
          ]}
        />
      </Group>
      {visualization === "graph" && o2o && objectAttributes && (
        <Graph
          key={ocelId}
          initialNodes={nodes}
          initialEdges={o2o.response.map(
            ({ source, target, sum, qualifier }) => ({
              source,
              target,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: {
                strokeWidth: "2px",
              },
              data: { mid: `${qualifier} (${sum})` },
            }),
          )}
          layoutOptions={{
            type: "elk",
            options: {
              "elk.algorithm": "layered",
              "elk.direction": "RIGHT",
              "elk.spacing.nodeNode": 50,
              "elk.layered.spacing.nodeNodeBetweenLayers": 100,
            },
          }}
        />
      )}
      {visualization === "cards" && objectCounts && (
        <EntityOverview
          entityCounts={objectCounts}
          attributes={objectAttributes}
          relations={o2o?.response ?? []}
          search={searchValue}
        />
      )}
    </Stack>
  );
};

export default defineModuleRoute({
  component: ObjectGraph,
  label: "Object Overview",
  name: "objectOverview",
  requiresOcel: true,
});
