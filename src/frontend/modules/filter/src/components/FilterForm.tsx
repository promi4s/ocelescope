import { ActionIcon, ActionIconGroup, Group, Tabs } from "@mantine/core";
import { CheckIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useCurrentFilterTab } from "../hooks/useSearchParams";
import type { FilterKey, NativeFilter } from "../types/filter";
import {
  cleanUpFilters,
  FILTER_MAP,
  generateDefaultFilter,
} from "./FilterViews";

type FilterFormProps = {
  ocelId: string;
  currentFilter: NativeFilter[];
  onSubmit?: (filters: NativeFilter[]) => void;
};

const FilterForm = ({ ocelId, currentFilter, onSubmit }: FilterFormProps) => {
  const { control, handleSubmit, reset } = useForm({
    defaultValues: generateDefaultFilter(currentFilter),
  });

  const { currentTab, setCurrentTab } = useCurrentFilterTab({
    tabs: Object.keys(FILTER_MAP) as FilterKey[],
    defaultTab: "activity",
    queryKey: "tab",
  });

  return (
    <Tabs
      value={currentTab}
      onChange={(newTab) => setCurrentTab(newTab as FilterKey)}
      keepMounted={false}
    >
      <Group>
        <Tabs.List flex={1}>
          {Object.entries(FILTER_MAP).map(([key, { title }]) => (
            <Tabs.Tab key={key} value={key}>
              {title}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <ActionIconGroup>
          <ActionIcon
            onClick={handleSubmit((data) => {
              onSubmit?.(cleanUpFilters(data));
            })}
            color="green"
          >
            <CheckIcon />
          </ActionIcon>
          <ActionIcon
            color="yellow"
            onClick={() => reset(generateDefaultFilter(currentFilter))}
          >
            <CheckIcon />
          </ActionIcon>
          <ActionIcon color="red" onClick={() => onSubmit?.([])}>
            <CheckIcon />
          </ActionIcon>
        </ActionIconGroup>
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
