import type {
  EventAttributes200,
  EventCounts200,
  RelationCountSummary,
} from "@/api/fastapi-schemas";
import { SimpleGrid } from "@mantine/core";
import { useMemo } from "react";
import EntityCard from "./EntityCard";

type EntityOverviewProps = {
  entityCounts: EventCounts200;
  relations: RelationCountSummary[];
  attributes: EventAttributes200;
  search?: string;
};

const EntityOverview: React.FC<EntityOverviewProps> = ({
  attributes,
  relations,
  entityCounts,
  search = "",
}) => {
  const relationMap = useMemo(() => {
    return relations.reduce<Record<string, RelationCountSummary[]>>(
      (relationMap, currentRelation) => {
        if (currentRelation.source in relationMap)
          relationMap[currentRelation.source].push(currentRelation);
        else relationMap[currentRelation.source] = [currentRelation];
        return relationMap;
      },
      {},
    );
  }, [relations]);

  const filteredEvents = useMemo(() => {
    const toSearch = search.toLowerCase();
    return Object.entries(entityCounts).filter(
      ([event, _]) =>
        event.toLowerCase().includes(search.toLowerCase()) ||
        relationMap[event]?.some(
          ({ target, qualifier }) =>
            target.toLowerCase().includes(toSearch) ||
            qualifier.toLowerCase().includes(toSearch),
        ) ||
        attributes[event]?.some(({ attribute }) =>
          attribute.toLowerCase().includes(toSearch),
        ),
    );
  }, [search, relationMap, entityCounts, attributes]);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 5 }}>
      {filteredEvents.map(([name, count]) => {
        return (
          <EntityCard
            key={name}
            count={count}
            name={name}
            attributeSummaries={attributes[name]}
            relationSummaries={relationMap[name]}
          />
        );
      })}
    </SimpleGrid>
  );
};

export default EntityOverview;
