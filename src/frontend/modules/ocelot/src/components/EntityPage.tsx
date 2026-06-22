import { Flex, Text, Title } from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import type { DataTableSortStatus } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import {
  useActivityColumns,
  useObjectColumns,
  usePaginatedEvents,
  usePaginatedObjects,
} from "../api/base";
import EntityTable from "./EntityTable";
import SingleLineTabs from "./SingleLineTabs/SingleLineTabs";

const EntityPage: React.FC<{
  ocelId: string;
  type: "events" | "objects";
  title?: string;
  description?: string;
}> = ({ ocelId, type, title, description }) => {
  const areEntitiesEvents = type === "events";

  const { data: entityCounts } = (
    areEntitiesEvents ? useEventCounts : useObjectCounts
  )(ocelId);

  const [currentTab, setCurrentTab] = useState<string | null>(null);
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
    ocelId,
    {
      type: currentTab ?? "",
      page_size: pageSize,
      page,
      ...(sort && {
        sort_by: sort.columnAccessor,
        ascending: sort.direction === "asc",
      }),
    },
    {
      query: {
        enabled: !!currentTab,
        placeholderData: keepPreviousData,
        staleTime: 5000,
      },
    },
  );

  const { data } = (areEntitiesEvents ? useActivityColumns : useObjectColumns)(
    ocelId,
    { type_name: currentTab ?? "" },
    {
      query: {
        enabled: !!currentTab,
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
      {title && <Title order={2}>{title}</Title>}
      {description && (
        <Text c="dimmed" size="sm" mb="xs">
          {description}
        </Text>
      )}
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
        currentTab={currentTab ?? entityNames[0] ?? ""}
      />
      {entities && (
        <EntityTable
          entities={entities}
          columns={data ?? []}
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
