import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { useGetFilter } from "../api/base";
import FilterForm from "../components/FilterForm";

const FilterPage = () => {
  const { id: ocelId } = useCurrentOcel();

  const { data: filterPipeline } = useGetFilter(ocelId ?? "", {
    query: { enabled: !!ocelId },
  });

  return (
    <>
      {filterPipeline && (
        <FilterForm ocelId={ocelId as string} currentFilter={filterPipeline} />
      )}
    </>
  );
};

export default defineModuleRoute({
  component: FilterPage,
  label: "Filter",
  name: "filter",
  requiresOcel: true,
});
