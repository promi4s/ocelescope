import type { FilterType } from "../types/filter";
import { EntityTypeFilter } from "./FilterComponents/ActivityForm";

const FilterMap: Record<FilterType, React.ComponentType<{ ocelId: string }>> = {
  activity: EntityTypeFilter("events"),
  object_type: EntityTypeFilter("objects"),
  time_frame: () => <></>,
  e2o_count: () => <></>,
  o2o_count: () => <></>,
  event_attributes: () => <></>,
  object_attribute: () => <></>,
};

const FilterForm: React.FC<{
  ocelId: string;
  selectedType: FilterType;
}> = ({ ocelId, selectedType }) => {
  const FilterComponent = FilterMap[selectedType];

  return <FilterComponent ocelId={ocelId} />;
};

export default FilterForm;
