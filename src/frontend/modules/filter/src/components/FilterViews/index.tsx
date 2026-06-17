import type {
  FilterKey,
  FilterViewType,
  GroupedFilter,
  NativeFilter,
} from "../../types/filter";
import { EventAttributeFilter, ObjectAttributeFilter } from "./AttributeFilter";
import { E2OCountFilter, O2OCountFilter } from "./RelationCountFilter";
import { TimeFrameFilter } from "./TimeFrameFilter";
import { ActivityFilter, ObjectTypeFilter } from "./TypeForm";

export const FILTER_MAP: { [T in FilterKey]: FilterViewType<T> } = {
  activity: ActivityFilter,
  object_type: ObjectTypeFilter,
  time_frame: TimeFrameFilter,
  event_attribute: EventAttributeFilter,
  object_attribute: ObjectAttributeFilter,
  e2o_count: E2OCountFilter,
  o2o_count: O2OCountFilter,
} as const;

export const generateDefaultFilter = (currentFilters: NativeFilter[]) => {
  const groupedFilter = currentFilters.reduce(
    (acc, curr) => {
      return {
        ...acc,
        [curr.type]: acc[curr.type]
          ? [...(acc[curr.type] ?? []), curr]
          : [curr],
      };
    },
    {} as Partial<GroupedFilter>,
  );

  const missingFilterKeys = Object.keys(FILTER_MAP).filter(
    (key) => !(key in groupedFilter),
  ) as FilterKey[];

  return {
    ...groupedFilter,
    ...Object.fromEntries(
      missingFilterKeys.map((key) => [key, FILTER_MAP[key].generateDefault()]),
    ),
  } as GroupedFilter;
};

const defaultFilter = <T extends NativeFilter>(filters?: T[]) => {
  if (!filters || filters.length === 0) {
    return [];
  }

  return filters;
};

const cleanUpFilterByKey = <K extends FilterKey>(
  key: K,
  filters: GroupedFilter[K],
) => {
  const cleanUp = FILTER_MAP[key].cleanUpFilters ?? defaultFilter;
  return cleanUp(filters);
};

export const cleanUpFilters = (filter: Partial<GroupedFilter>) => {
  return (Object.keys(filter) as FilterKey[])
    .flatMap((key) => {
      const filters = filter[key];
      if (!filters) return [];

      return cleanUpFilterByKey(key, filters);
    })
    .filter((filter) => !!filter);
};
