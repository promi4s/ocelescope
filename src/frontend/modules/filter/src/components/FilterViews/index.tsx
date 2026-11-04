import type { StepKinds } from "@ocelescope/core";
import type { GetFilterQueryResult } from "../../api/base";
import {
  eventAttributeKind,
  objectAttributeKind,
} from "./AttributeFilter/AttributeFilter";
import {
  e2oCountKind,
  o2oCountKind,
} from "./RelationCountFilter/RelationCountFilter";
import { timeFrameKind } from "./TimeFrameFilter";
import { activityKind, objectTypeKind } from "./TypeForm";

export type NativeFilter = GetFilterQueryResult[number];

export const FILTER_KINDS: StepKinds<NativeFilter> = {
  activity: activityKind,
  object_type: objectTypeKind,
  time_frame: timeFrameKind,
  event_attribute: eventAttributeKind,
  object_attribute: objectAttributeKind,
  e2o_count: e2oCountKind,
  o2o_count: o2oCountKind,
};
