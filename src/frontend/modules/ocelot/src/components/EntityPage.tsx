import { Flex } from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { useCurrentOcel } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import type { DataTableSortStatus } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import { usePaginatedEvents, usePaginatedObjects } from "../api/base";
import EntityTable from "./EntityTable";
import SingleLineTabs from "./SingleLineTabs/SingleLineTabs";

const EntityPage: React.FC<{ type: "events" | "objects" }> = ({ type }) => {
  const { id } = useCurrentOcel();

  const areEntitiesEvents = type === "events";

  const { data: entityCounts } = (
    areEntitiesEvents ? useEventCounts : useObjectCounts
  )(id);

  const [currentTab, setCurrentTab] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSortStatus | undefined>(undefined);

  const [pageSize, setPageSize] = useState(20);

  const entityNames = useMemo(
    () => Object.keys(entityCounts ?? {}),
    [entityCounts],
  );

  const { data: entities } = (
    areEntitiesEvents ? usePaginatedEvents : usePaginatedObjects
  )(
    id,
    {
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
      setCurrentTab(entityNames[0]!);
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
          withTimestamp={type === "events"}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
          sortStatus={sort}
          onStartStatusChange={(sortStatus) => setSort(sortStatus)}
        />
      )}
    </Flex>
  );
};

export default EntityPage;
