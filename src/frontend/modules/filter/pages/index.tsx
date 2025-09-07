import { defineModuleRoute } from "@/lib/modules";
import { OCELFilter } from "@/api/fastapi-schemas";
import { useGetFilters, useSetFilters } from "@/api/fastapi/ocels/ocels";
import { Box, LoadingOverlay } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { useRef } from "react";
import FilterForm from "../components/FilterForm";
import useCurrentOcel from "@/hooks/useCurrentOcel";

const FilterPage = () => {
  const { id: ocelId } = useCurrentOcel();

  const {
    data: filter,
    isLoading: isFilterLoading,
    refetch,
  } = useGetFilters(
    {
      ocel_id: ocelId as string,
    },
    { query: { enabled: !!ocelId } },
  );

  const resetFormRef = useRef<(filter: OCELFilter) => void>(() => {});

  const { mutate: applyFilter, isPending: isApplying } = useSetFilters({
    mutation: {
      onSuccess: async (data) => {
        await refetch();
        resetFormRef.current?.(data as OCELFilter);
        showNotification({
          message: "Filter successfully applied",
          color: "green",
        });
      },
    },
  });

  return (
    <Box pos={"relative"}>
      <LoadingOverlay visible={!ocelId || isApplying || isFilterLoading} />
      {!isFilterLoading && (
        <FilterForm
          ocelId={ocelId as string}
          filter={filter ?? {}}
          onSubmit={(value) => applyFilter({ data: value })}
          onResetRef={(fn) => {
            resetFormRef.current = fn;
          }}
        />
      )}
    </Box>
  );
};

export default defineModuleRoute({
  component: FilterPage,
  label: "Filter",
  name: "filter",
  requiresOcel: true,
});
