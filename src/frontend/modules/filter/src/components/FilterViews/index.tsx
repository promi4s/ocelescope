import type {
  FilterKey,
  FilterKind,
  FilterOf,
  NativeFilter,
} from "../../types/filter";
import {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "./AttributeFilter/AttributeFilter";
import { E2OCountFilter, O2OCountFilter } from "./RelationCountFilter";
import { TimeFrameFilter } from "./TimeFrameFilter";
import { ActivityFilter, ObjectTypeFilter } from "./TypeForm";

export const FILTER_KINDS: { [T in FilterKey]: FilterKind<T> } = {
  activity: ActivityFilter,
  object_type: ObjectTypeFilter,
  time_frame: TimeFrameFilter,
  event_attribute: EventAttributeFilter,
  object_attribute: ObjectAttributeFilter,
  e2o_count: E2OCountFilter,
  o2o_count: O2OCountFilter,
} as const;

export const kindOf = <T extends FilterKey>(filter: FilterOf<T>) =>
  FILTER_KINDS[filter.type as T] as FilterKind<T>;

export const completeSteps = (steps: NativeFilter[]) =>
  steps.filter((step) => kindOf(step).isComplete(step));
