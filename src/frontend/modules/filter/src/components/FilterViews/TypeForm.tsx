import { InlineStyles, Stack } from "@mantine/core";
import {
  ActivityPicker,
  ObjectTypePicker,
  type StepKind,
  type StepPanel,
  viewProps,
} from "@ocelescope/core";
import type { ActivityFilter, ObjectTypeFilter } from "../../api/base";

const PICKER_CLASS = "ocelescope-type-filter-picker";

const FillHeightStyles = () => (
  <>
    <InlineStyles
      deduplicate
      selector={`.${PICKER_CLASS} :has([role="listbox"])`}
      styles={{ flex: 1, minHeight: 0 }}
    />
    <InlineStyles
      deduplicate
      selector={`.${PICKER_CLASS} [role="listbox"]`}
      styles={{ flex: 1, minHeight: 0, maxHeight: "none !important" }}
    />
  </>
);

const listed = (names: string[], noun: string) => {
  if (names.length === 0) {
    return `No ${noun} selected`;
  }
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2} more` : shown;
};

const ActivityPanel: StepPanel<ActivityFilter> = ({
  ocelId,
  viewId,
  step: filter,
  onChange,
}) => (
  <Stack gap={4} flex={1} mih={0} className={PICKER_CLASS}>
    <FillHeightStyles />
    <ActivityPicker
      variant="list"
      multiple
      cutoff
      ocelId={ocelId}
      {...viewProps(viewId)}
      value={filter.event_types}
      onChange={(next) => onChange({ ...filter, event_types: next })}
    />
  </Stack>
);

const ObjectTypePanel: StepPanel<ObjectTypeFilter> = ({
  ocelId,
  viewId,
  step: filter,
  onChange,
}) => (
  <Stack gap={4} flex={1} mih={0} className={PICKER_CLASS}>
    <FillHeightStyles />
    <ObjectTypePicker
      variant="list"
      multiple
      cutoff
      ocelId={ocelId}
      {...viewProps(viewId)}
      value={filter.object_types}
      onChange={(next) => onChange({ ...filter, object_types: next })}
    />
  </Stack>
);

export const activityKind: StepKind<ActivityFilter> = {
  title: "Activity",
  description:
    "Keeps only the events of the selected activities (the event types). The list shows how many events exist per activity to help you decide what to keep.",
  Panel: ActivityPanel,
  create: () => ({ type: "activity", event_types: [], mode: "include" }),
  summary: (filter) => listed(filter.event_types, "activities"),
  validate: (filter) =>
    filter.event_types.length > 0
      ? {}
      : { event_types: "Pick at least one activity" },
};

export const objectTypeKind: StepKind<ObjectTypeFilter> = {
  title: "Object Type",
  description:
    "Keeps only the objects of the selected types. The list shows how many objects exist per type to help you decide what to keep.",
  Panel: ObjectTypePanel,
  create: () => ({ type: "object_type", object_types: [], mode: "include" }),
  summary: (filter) => listed(filter.object_types, "object types"),
  validate: (filter) =>
    filter.object_types.length > 0
      ? {}
      : { object_types: "Pick at least one object type" },
};
