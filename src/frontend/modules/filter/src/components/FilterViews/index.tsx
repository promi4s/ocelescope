import type { ComponentType } from "react";
import type { Control } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";
import { EventAttributeFilter, ObjectAttributeFilter } from "./AttributeFilter";
import { E2OCountFilter, O2OCountFilter } from "./RelationCountFilter";
import { TimeFrameFilter } from "./TimeFrameFilter";
import { ActivityFilter, ObjectTypeFilter } from "./TypeForm";

export type FilterViewType = {
  title: string;
  ViewComponent: ComponentType<{
    ocelId: string;
    control: Control<GroupedOCELFilter>;
  }>;
};

export const FilterMap: Record<keyof GroupedOCELFilter, FilterViewType> = {
  activity: ActivityFilter,
  object_type: ObjectTypeFilter,
  time_frame: TimeFrameFilter,
  event_attribute: EventAttributeFilter,
  object_attribute: ObjectAttributeFilter,
  e2o_count: E2OCountFilter,
  o2o_count: O2OCountFilter,
};
