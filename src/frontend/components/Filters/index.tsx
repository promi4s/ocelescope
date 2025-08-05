import {
  ActionIcon,
  Button,
  ButtonGroup,
  Divider,
  Flex,
  Group,
  Paper,
  Select,
  Stack,
  Title,
} from "@mantine/core";
import { Control, useForm } from "react-hook-form";

import { memo, useCallback, useMemo, useState } from "react";
import { FilterType, Filter, FilterConfigByType } from "@/types/filters";
import { Check, Plus, RefreshCw, X } from "lucide-react";
import { OcelInputType } from "@/types/ocel";
import {
  EventTypeFilterInput,
  ObjectTypeFilterInput,
} from "./FilterComponents/EntityTypeFilter";
import TimeFrameFilter from "./FilterComponents/TimeFrameFilter";
import {
  E2OCountFilter,
  O2OCountFilter,
} from "./FilterComponents/RelationFilter";
import {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "./FilterComponents/AttributeFilter";

export type FilterPropsType<K extends FilterType> = {
  ocelParams: OcelInputType;
  control: Control<{ value: FilterConfigByType<K> }>;
};

type FilterConfigDefinition<K extends FilterType> = {
  defaultValue: FilterConfigByType<K>;
  label: string;
  filterForm: React.ComponentType<FilterPropsType<K>>;
};

export const filterMap: { [K in FilterType]: FilterConfigDefinition<K> } = {
  e2o_count: {
    defaultValue: [],
    label: "E2O Count Filter",
    filterForm: E2OCountFilter,
  },
  o2o_count: {
    defaultValue: [],
    filterForm: O2OCountFilter,
    label: "O2O Count Filter",
  },
  event_type: {
    defaultValue: { mode: "include", event_types: [] },
    label: "Event Type Filter",
    filterForm: EventTypeFilterInput,
  },
  object_types: {
    defaultValue: { mode: "include", object_types: [] },
    label: "Object Type Filter",
    filterForm: ObjectTypeFilterInput,
  },
  time_range: {
    defaultValue: { mode: "include", time_range: [null, null] },
    label: "Time Frame Filter",
    filterForm: TimeFrameFilter,
  },
  event_attributes: {
    defaultValue: [],
    label: "Event Attribute Filter",
    filterForm: EventAttributeFilter,
  },
  object_attributes: {
    defaultValue: [],
    label: "Object Attribute Filter",
    filterForm: ObjectAttributeFilter,
  },
} as const;

const FilterFormItem = memo(
  <T extends FilterType>({
    value,
    ocelId,
    type,
    onDelete,
    onSubmit,
  }: {
    value: FilterConfigByType<T>;
    ocelId?: string;
    type: FilterType;
    onDelete: () => void;
    onSubmit: (value: FilterConfigByType<T>) => void;
  }) => {
    const {
      control,
      formState: { isDirty, isValid },
      handleSubmit,
      reset,
    } = useForm<{ value: FilterConfigByType<T> }>({
      defaultValues: {
        value: value ?? (filterMap[type].defaultValue as FilterConfigByType<T>),
      },
    });

    const Component = filterMap[type]
      .filterForm as FilterConfigDefinition<T>["filterForm"];

    return (
      <Paper
        shadow="xl"
        p={"md"}
        component="form"
        onSubmit={handleSubmit(({ value }) => {
          onSubmit(
            Array.isArray(value) && value.length === 0 ? undefined : value,
          );
        })}
      >
        <Stack>
          <Group justify="space-between">
            <Title size={"h3"}> {filterMap[type].label}</Title>
            <ButtonGroup>
              <Button px={8} color={"red"} onClick={onDelete}>
                <X />
              </Button>
              {isDirty && isValid && (
                <>
                  <Button
                    px={8}
                    color={"yellow"}
                    onClick={() =>
                      reset({
                        value:
                          value ??
                          (filterMap[type]
                            .defaultValue as FilterConfigByType<T>),
                      })
                    }
                  >
                    <RefreshCw />
                  </Button>
                  <Button px={8} color={"green"} type="submit">
                    <Check />
                  </Button>
                </>
              )}
            </ButtonGroup>
          </Group>
          <Component
            ocelParams={{ ocel_id: ocelId, ocel_version: "original" }}
            control={control as Control<{ value: FilterConfigByType<T> }>}
          />
        </Stack>
      </Paper>
    );
  },
);

const FilterPipelineForm: React.FC<
  {
    filter: Filter;
    submit: (filter: Filter) => void;
  } & Pick<OcelInputType, "ocel_id">
> = ({ filter, submit, ocel_id }) => {
  const [selectedFields, setSelectedFields] = useState<Set<FilterType>>(
    new Set(Object.keys(filter ?? {}) as FilterType[]),
  );

  const [nextFilterType, setNextFilterType] = useState<
    FilterType | undefined
  >();

  const notShownFields = useMemo(
    () =>
      Object.keys(filterMap).filter(
        (filterType) => !selectedFields.has(filterType as FilterType),
      ),
    [selectedFields],
  );

  const handleDelete = useCallback(
    (typeToDelete: FilterType) => {
      setSelectedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(typeToDelete);
        return newSet;
      });

      submit(
        Object.fromEntries(
          Object.entries(filter).filter(
            ([filterType]) => filterType !== typeToDelete,
          ),
        ),
      );
    },
    [filter, submit],
  );

  const handleSubmit = useCallback(
    (type: FilterType, value: FilterConfigByType<typeof type>) => {
      submit({ ...filter, [type]: value });
    },
    [filter, submit],
  );
  return (
    <Flex direction={"column"} h={"100%"} pb={"md"}>
      <Group pb={10} justify="space-between">
        <Group gap={0}>
          <Select
            value={nextFilterType ?? (notShownFields[0] as FilterType)}
            data={notShownFields.map((type) => ({
              value: type,
              label: filterMap[type as FilterType].label,
            }))}
            onChange={(newNextFilter) => {
              if (newNextFilter) {
                setNextFilterType(newNextFilter as FilterType);
              }
            }}
            allowDeselect={false}
          />
          <ActionIcon
            color={"green"}
            size={"36px"}
            onClick={() => {
              setSelectedFields((prev) => {
                const newSelectedFields = new Set(prev);
                newSelectedFields.add(
                  nextFilterType ?? (notShownFields[0] as FilterType),
                );
                return newSelectedFields;
              });
              setNextFilterType(undefined);
            }}
          >
            <Plus />
          </ActionIcon>
        </Group>
      </Group>
      <Divider />
      <Stack flex={1} style={{ overflow: "scroll" }} p={"sm"}>
        {Array.from(selectedFields).map((type) => (
          <FilterFormItem
            key={type}
            value={filter[type] ?? filterMap[type].defaultValue}
            type={type}
            ocelId={ocel_id ?? undefined}
            onDelete={() => handleDelete(type)}
            onSubmit={(value) => handleSubmit(type, value)}
          />
        ))}
      </Stack>
    </Flex>
  );
};

export default FilterPipelineForm;
