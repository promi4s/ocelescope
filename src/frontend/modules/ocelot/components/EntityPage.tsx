import {
  useE2o,
  useEventAttributes,
  useEventCounts,
  useO2o,
  useObjectAttributes,
  useObjectCounts,
} from "@/api/fastapi/ocels/ocels";
import {
  useOcelotPaginatedEvents,
  useOcelotPaginatedObjects,
} from "@/api/fastapi/ocelot/ocelot";
import SingleLineTabs from "@/modules/ocelot/components/SingleLineTabs/SingleLineTabs";
import { keepPreviousData } from "@tanstack/react-query";

import { useEffect, useMemo, useState } from "react";
import EntityTable from "./EntityTable";
import { Flex } from "@mantine/core";
import type { DataTableSortStatus } from "mantine-datatable";
import useCurrentOcel from "@/hooks/useCurrentOcel";

const EntityPage: React.FC<{ type: "events" | "objects" }> = ({ type }) => {
  const { id } = useCurrentOcel();

  const areEntitiesEvents = type === "events";

  const { data: entityCounts } = (
    areEntitiesEvents ? useEventCounts : useObjectCounts
  )({
    ocel_id: id,
  });

  const { data: attributes } = (
    areEntitiesEvents ? useEventAttributes : useObjectAttributes
  )({
    ocel_id: id,
  });

  const [currentTab, setCurrentTab] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSortStatus | undefined>(undefined);

  const [pageSize, setPageSize] = useState(20);

  const entityNames = useMemo(
    () => Object.keys(entityCounts ?? {}),
    [entityCounts],
  );

  //TODO: Make this in a collapsable table rather then extra collumns
  const { data: unfilteredRelations = [] } = (
    areEntitiesEvents ? useE2o : useO2o
  )({
    ocel_id: id,
  });

  const relations = useMemo(() => {
    return unfilteredRelations.filter(({ source }) => source === currentTab);
  }, [unfilteredRelations, currentTab]);

  const { data: entities } = (
    areEntitiesEvents ? useOcelotPaginatedEvents : useOcelotPaginatedObjects
  )(
    {
      ocel_id: id,
      type: currentTab,
      page_size: pageSize,
      page,
      ...(sort && {
        sort_by: sort.columnAccessor,
        ascending: sort.direction === "asc",
      }),
    },
    {
      query: {
        placeholderData: keepPreviousData,
        staleTime: 5000,
      },
    },
  );

  useEffect(() => {
    if (!currentTab && entityNames.length > 0) {
      setCurrentTab(entityNames[0]);
    }
  }, [currentTab, entityNames]);

  if (entityNames.length === 0) return null;

  return (
    <Flex direction={"column"} h={"100%"}>
      <SingleLineTabs
        tabs={Object.entries(entityCounts ?? {}).map(([entityName, count]) => ({
          value: entityName,
          label: `${entityName} (${count})`,
        }))}
        setCurrentTab={(newTab) => {
          setCurrentTab(newTab);
          setPage(1);
          setSort(undefined);
        }}
        currentTab={currentTab ?? entityNames[0]}
      />
      {entities && (
        <EntityTable
          entities={entities}
          attributes={attributes?.[currentTab ?? entityNames[0]]}
          withTimestamp={type === "events"}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
          relations={relations}
          sortStatus={sort}
          onStartStatusChange={(sortStatus) => setSort(sortStatus)}
        />
      )}
    </Flex>
  );
};

export default EntityPage;
