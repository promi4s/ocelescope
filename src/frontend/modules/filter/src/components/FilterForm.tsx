import { Group, Tabs } from "@mantine/core";
import { useForm } from "react-hook-form";
import type { NativeFilter } from "../types/filter";
import { FILTER_MAP, generateDefaultFilter } from "./FilterViews";

const FilterForm: React.FC<{
  ocelId: string;
  currentFilter: NativeFilter[];
}> = ({ ocelId, currentFilter }) => {
  const { control } = useForm({
    defaultValues: generateDefaultFilter(currentFilter),
  });

  return (
    <Tabs defaultValue={"activity"}>
      <Group>
        <Tabs.List>
          {Object.entries(FILTER_MAP).map(([key, { title }]) => (
            <Tabs.Tab key={key} value={key}>
              {title}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Group>

      {Object.entries(FILTER_MAP).map(([key, { ViewComponent }]) => (
        <Tabs.Panel key={key} value={key} p={"md"}>
          <ViewComponent control={control} ocelId={ocelId} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};

export default FilterForm;
