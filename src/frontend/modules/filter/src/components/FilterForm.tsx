import { Tabs } from "@mantine/core";
import { type Control, useForm } from "react-hook-form";
import type { GroupedOCELFilter } from "../api/base";
import TimeFrameFilter from "./FilterComponents/TimeFrameFilter";
import { ActivityFilter, ObjectTypeFilter } from "./FilterComponents/TypeForm";

const FilterMap: Record<
  keyof GroupedOCELFilter,
  React.ComponentType<{ ocelId: string; control: Control<GroupedOCELFilter> }>
> = {
  activity: ActivityFilter,
  object_type: ObjectTypeFilter,
  time_frame: TimeFrameFilter,
  e2o_count: () => <></>,
  o2o_count: () => <></>,
  event_attribute: () => <></>,
  object_attribute: () => <></>,
};

const TAB_TITLES: Record<keyof GroupedOCELFilter, string> = {
  activity: "Activities",
  object_type: "Object Types",
  time_frame: "Time Frame",
  e2o_count: "E2O Count",
  o2o_count: "O2O Count",
  event_attribute: "Event Attribute",
  object_attribute: "Object Attribute",
} as const;

const FilterForm: React.FC<{
  ocelId: string;
  currentFilter: GroupedOCELFilter;
}> = ({ ocelId, currentFilter }) => {
  const { control } = useForm({ defaultValues: currentFilter });

  return (
    <Tabs defaultValue={"activity"}>
      <Tabs.List>
        {Object.entries(TAB_TITLES).map(([key, title]) => (
          <Tabs.Tab key={key} value={key}>
            {title}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {Object.entries(FilterMap).map(([key, Filter]) => (
        <Tabs.Panel key={key} value={key} p={"md"}>
          <Filter control={control} ocelId={ocelId} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};

export default FilterForm;
