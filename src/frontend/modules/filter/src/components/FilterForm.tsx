import {
  ActionIcon,
  ActionIconGroup,
  Group,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { CheckIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
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
  const { control, handleSubmit, reset, formState } = useForm({
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
          {formState.isDirty && (
            <>
              <ActionIcon
                onClick={handleSubmit((data) => {
                  onSubmit?.(cleanUpFilters(data));
                })}
                size={"lg"}
                color="green"
              >
                <CheckIcon size={24} />
              </ActionIcon>
              <ActionIcon
                size={"lg"}
                color="yellow"
                onClick={() => reset(generateDefaultFilter(currentFilter))}
              >
                <RotateCcwIcon size={24} />
              </ActionIcon>
            </>
          )}
          {currentFilter.length > 0 && (
            <ActionIcon size={"lg"} color="red" onClick={() => onSubmit?.([])}>
              <Trash2Icon size={24} />
            </ActionIcon>
          )}
        </ActionIconGroup>
      </Group>

      {Object.entries(FILTER_MAP).map(
        ([key, { ViewComponent, description }]) => (
          <Tabs.Panel key={key} value={key} p={"md"}>
            <Stack gap={"md"}>
              <Text size="sm" c="dimmed">
                {description} Afterwards the log is cleaned up automatically:
                relations whose source or target is missing are removed, events
                without at least one E2O relation are filtered out, and objects
                without any E2O or O2O relation are filtered out too.
              </Text>
              <ViewComponent control={control} ocelId={ocelId} />
            </Stack>
          </Tabs.Panel>
        ),
      )}
    </Tabs>
  );
};

export default FilterForm;
