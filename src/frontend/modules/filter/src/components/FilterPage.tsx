import { LoadingOverlay } from "@mantine/core";
import {
  defineModuleRoute,
  useCurrentOcel,
  useInvalidate,
} from "@ocelescope/core";
import hash from "object-hash";
import { useGetFilter, useSetFilter } from "../api/base";
import FilterForm from "../components/FilterForm";

const FilterPage = () => {
  const { id: ocelId } = useCurrentOcel();

  const { data: filterPipeline, refetch } = useGetFilter(ocelId ?? "", {
    query: { enabled: !!ocelId },
  });

  const invalidate = useInvalidate();

  const { mutate, status } = useSetFilter({
    mutation: {
      onSuccess: async () => {
        refetch();
        await invalidate(["ocels"]);
      },
    },
  });
  return (
    <>
      {filterPipeline && ocelId && (
        <FilterForm
          ocelId={ocelId as string}
          key={hash(filterPipeline)}
          currentFilter={filterPipeline}
          onSubmit={(filter) => mutate({ ocelId, data: filter })}
        />
      )}
      <LoadingOverlay visible={status === "pending"} />
    </>
  );
};

export default defineModuleRoute({
  component: FilterPage,
  label: "Filter",
  name: "filter",
  requiresOcel: true,
});
