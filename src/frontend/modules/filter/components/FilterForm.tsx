import type { OCELFilter } from "@/api/fastapi-schemas";
import { filterMap } from "@/modules/filter/components/Filters";
import type { FilterType } from "@/types/filters";
import { Button, ButtonGroup, Group, Tabs } from "@mantine/core";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

function cleanObject(obj: any): any {
  if (Array.isArray(obj)) {
    // Clean each item and remove empty/undefined ones
    const cleanedArray = obj
      .map(cleanObject)
      .filter(
        (item) =>
          item !== undefined &&
          !(Array.isArray(item) && item.length === 0) &&
          !(
            typeof item === "object" &&
            item !== null &&
            Object.keys(item).length === 0
          ),
      );
    return cleanedArray;
  }

  if (typeof obj === "object" && obj !== null) {
    const cleanedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanObject(value);
      const isEmptyObject =
        typeof cleanedValue === "object" &&
        cleanedValue !== null &&
        !Array.isArray(cleanedValue) &&
        Object.keys(cleanedValue).length === 0;
      const isEmptyArray =
        Array.isArray(cleanedValue) && cleanedValue.length === 0;

      if (cleanedValue !== undefined && !isEmptyObject && !isEmptyArray) {
        cleanedObj[key] = cleanedValue;
      }
    }
    return cleanedObj;
  }

  return obj;
}

//TODO: End slop this a little
const FilterForm: React.FC<{
  filter: OCELFilter;
  ocelId: string;
  onSubmit: (value: OCELFilter) => void;
  onResetRef?: (resetFn: (data: OCELFilter) => void) => void;
}> = ({ filter, ocelId, onSubmit, onResetRef }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<OCELFilter>({
    defaultValues: filter,
    resetOptions: { keepDirty: false },
  });

  const isFormEmpty = useMemo(
    () => Object.entries(filter).length === 0,
    [filter],
  );

  useEffect(() => {
    onResetRef?.((data) => {
      return reset(
        {
          event_attributes: [],
          object_attributes: [],
          o2o_count: [],
          e2o_count: [],
          ...cleanObject(data ?? {}),
        },
        { keepDirty: false },
      );
    });
  }, [reset, onResetRef]);

  return (
    <Tabs keepMounted={false} defaultValue={Object.keys(filterMap)[0]}>
      <Group gap={0}>
        <Tabs.List grow flex={1}>
          {Object.keys(filterMap).map((filterType) => (
            <Tabs.Tab value={filterType} key={filterType}>
              {filterMap[filterType as FilterType].label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <ButtonGroup>
          {!isFormEmpty && (
            <Button color={"red"} px={8} onClick={() => onSubmit({})}>
              <XIcon />
            </Button>
          )}
          {isDirty && (
            <Button
              color={"yellow"}
              px={8}
              onClick={() =>
                reset(
                  {
                    event_attributes: [],
                    object_attributes: [],
                    o2o_count: [],
                    e2o_count: [],
                    ...cleanObject(filter),
                  },
                  { keepDirty: false },
                )
              }
            >
              <RotateCcwIcon />
            </Button>
          )}
          {isValid && isDirty && (
            <Button
              color={"green"}
              px={8}
              onClick={handleSubmit((data) => onSubmit(cleanObject(data)))}
            >
              <CheckIcon />
            </Button>
          )}
        </ButtonGroup>
      </Group>
      {Object.entries(filterMap).map(([filterType, { filterPage }]) => {
        const Component = filterPage;
        return (
          <Tabs.Panel key={filterType} value={filterType} p={"md"}>
            <Component
              control={control}
              ocelParams={{
                ocel_id: ocelId as string,
                ocel_version: "original",
              }}
            />
          </Tabs.Panel>
        );
      })}
    </Tabs>
  );
};

export default FilterForm;
