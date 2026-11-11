import type { StepKinds } from "@ocelescope/core";
import type { GetFilterQueryResult } from "../../api/base";
import { eventAttributeKind, objectAttributeKind } from "./AttributeFilter";
import { e2oCountKind, e2oObjectKind, o2oCountKind } from "./RelationFilter";
import { timeFrameKind } from "./TimeFrameFilter";
import { activityKind, objectTypeKind } from "./TypeFilter";

export type NativeFilter = GetFilterQueryResult[number];

export const FILTER_KINDS: StepKinds<NativeFilter> = {
  activity: activityKind,
  object_type: objectTypeKind,
  time_frame: timeFrameKind,
  event_attribute: eventAttributeKind,
  object_attribute: objectAttributeKind,
  e2o_count: e2oCountKind,
  e2o_object: e2oObjectKind,
  o2o_count: o2oCountKind,
};
