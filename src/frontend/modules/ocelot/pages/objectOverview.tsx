import {
  useO2o,
  useObjectAttributes,
  useObjectCount,
} from "@/api/fastapi/ocels/ocels";
import Graph, { NodeComponents } from "@/components/Graph";
import { Group, Input, SegmentedControl, Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import { MarkerType } from "@xyflow/react";
import EntityCard from "../components/EntityCard";
import EntityOverview from "../components/EntityOverview";
import { SearchIcon } from "lucide-react";
import { useDebouncedState } from "@mantine/hooks";
import { defineModuleRoute } from "@/lib/modules";
import useCurrentOcel from "@/hooks/useCurrentOcel";

const ObjectGraph = () => {
  const { id: ocelId } = useCurrentOcel();
  const { data: o2o } = useO2o({ ocel_id: ocelId });
  const { data: objectAttributes } = useObjectAttributes({ ocel_id: ocelId });
  const { data: objectCounts } = useObjectCount({ ocel_id: ocelId });

  const [searchValue, setSearchValue] = useDebouncedState("", 200);
  const [vizualization, setVizualization] = useState<"graph" | "cards">(
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
                attributeSummaries={objectAttributes[objectName]}
              />
            ),
          },
        }) satisfies NodeComponents,
    );
  }, [objectCounts, objectAttributes]);

  return (
    <Stack w={"100%"} h={"100%"}>
      <Group justify="end">
        {vizualization === "cards" && (
          <Input
            leftSection={<SearchIcon />}
            defaultValue={searchValue}
            onChange={(newSearch) => setSearchValue(newSearch.target.value)}
          />
        )}
        <SegmentedControl
          onChange={(newViz) =>
            setVizualization(newViz as typeof vizualization)
          }
          value={vizualization}
          data={[
            { label: "Graph", value: "graph" },
            { label: "Cards", value: "cards" },
          ]}
        />
      </Group>
      {vizualization === "graph" && o2o && objectAttributes && (
        <Graph
          initialNodes={nodes}
          initialEdges={o2o.map(({ source, target, sum, qualifier }) => ({
            source: source,
            target,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              strokeWidth: "2px",
            },
            data: { mid: `${qualifier} (${sum})` },
          }))}
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
      {vizualization === "cards" && objectCounts && (
        <EntityOverview
          entityCounts={objectCounts}
          attributes={objectAttributes ?? {}}
          relations={o2o ?? []}
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
