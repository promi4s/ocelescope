import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { useState } from "react";
import FilterForm from "../components/FilterForm";
import type { FilterType } from "../types/filter";

const FilterPage = () => {
  const { id: ocelId } = useCurrentOcel();

  const [currentFilter, setCurrentFilter] = useState<FilterType>("activity");

  return <FilterForm ocelId={ocelId as string} selectedType={currentFilter} />;
};

export default defineModuleRoute({
  component: FilterPage,
  label: "Filter",
  name: "filter",
  requiresOcel: true,
});
