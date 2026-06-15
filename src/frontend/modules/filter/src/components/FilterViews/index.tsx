import type { ComponentType } from "react";
import type { Control } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";
import { EventAttributeFilter, ObjectAttributeFilter } from "./AttributeFilter";
import { E2OCountFilter, O2OCountFilter } from "./RelationCountFilter";
import { TimeFrameFilter } from "./TimeFrameFilter";
import { ActivityFilter, ObjectTypeFilter } from "./TypeForm";

type FilterKey = NonNullable<keyof GroupedOCELFilter>;

export type FilterViewType<T extends FilterKey> = {
  title: string;
  ViewComponent: ComponentType<{
    ocelId: string;
    control: Control<GroupedOCELFilter>;
  }>;
  generateDefault: () => GroupedOCELFilter[T];
};

export const FILTER_MAP: { [T in FilterKey]: FilterViewType<T> } = {
  activity: ActivityFilter,
  object_type: ObjectTypeFilter,
  time_frame: TimeFrameFilter,
  event_attribute: EventAttributeFilter,
  object_attribute: ObjectAttributeFilter,
  e2o_count: E2OCountFilter,
  o2o_count: O2OCountFilter,
} as const;

type FilterPairs = {
  [K in FilterKey]: [K, GroupedOCELFilter[K]];
}[FilterKey];

export const generateDefaultFilter = (currentFilter: GroupedOCELFilter) => {
  return Object.fromEntries(
    (Object.entries(currentFilter) as FilterPairs[]).map(
      ([type, filter]) =>
        [type, filter ?? FILTER_MAP[type].generateDefault()] as const,
    ),
  ) as GroupedOCELFilter;
};
