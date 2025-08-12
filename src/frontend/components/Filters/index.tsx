import { OCELFilter } from "@/api/fastapi-schemas";
import { FilterType } from "@/types/filters";
import { OcelInputType } from "@/types/ocel";
import { Control } from "react-hook-form";
import {
  EventTypeFilterInput,
  ObjectTypeFilterInput,
} from "./FilterComponents/EntityTypeFilter";
import TimeFrameFilter from "./FilterComponents/TimeFrameFilter";
import {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "./FilterComponents/AttributeFilter";
import {
  E2OCountFilter,
  O2OCountFilter,
} from "./FilterComponents/RelationFilter";

export type FilterPageComponentProps = {
  control: Control<OCELFilter>;
  ocelParams: OcelInputType;
};
export const filterMap: {
  [K in FilterType]: {
    label: string;
    filterPage: React.ComponentType<FilterPageComponentProps>;
  };
} = {
  event_type: { label: "Event Type", filterPage: EventTypeFilterInput },
  object_types: { label: "Object Types", filterPage: ObjectTypeFilterInput },
  time_range: { label: "Time Range", filterPage: TimeFrameFilter },
  event_attributes: {
    label: "Event Attributes",
    filterPage: EventAttributeFilter,
  },
  object_attributes: {
    label: "Object Attributes",
    filterPage: ObjectAttributeFilter,
  },
  e2o_count: { label: "E2O Count", filterPage: E2OCountFilter },
  o2o_count: { label: "O2O Count", filterPage: O2OCountFilter },
} as const;
