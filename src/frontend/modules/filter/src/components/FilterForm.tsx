import { Tabs } from "@mantine/core";
import { useForm } from "react-hook-form";
import type { GroupedOCELFilter } from "../api/base";
import { FilterMap } from "./FilterViews";

const FilterForm: React.FC<{
  ocelId: string;
  currentFilter: GroupedOCELFilter;
}> = ({ ocelId, currentFilter }) => {
  const { control } = useForm({ defaultValues: currentFilter });

  return (
    <Tabs defaultValue={"activity"}>
      <Tabs.List>
        {Object.entries(FilterMap).map(([key, { title }]) => (
          <Tabs.Tab key={key} value={key}>
            {title}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {Object.entries(FilterMap).map(([key, { ViewComponent }]) => (
        <Tabs.Panel key={key} value={key} p={"md"}>
          <ViewComponent control={control} ocelId={ocelId} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};

export default FilterForm;
