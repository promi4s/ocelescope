import { InlineStyles, Stack } from "@mantine/core";
import { ActivityPicker, ObjectTypePicker } from "@ocelescope/core";
import { Controller } from "react-hook-form";
import type { FilterView, FilterViewType } from "../../types/filter";

const PICKER_CLASS = "ocelescope-type-filter-picker";

// The picker's list scrolls after eight rows; here it takes the height of
// the tab instead.
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

const EntityFilter: (
  entityType: "events" | "objects",
) => FilterView<"activity" | "object_type"> =
  (entityType) =>
  ({ ocelId, control }) => {
    const isEvents = entityType === "events";
    const Picker = isEvents ? ActivityPicker : ObjectTypePicker;

    return (
      <Controller
        name={isEvents ? `activity.${0}` : `object_type.${0}`}
        control={control}
        render={({ field }) => {
          const filter = field.value;
          const selected =
            filter?.type === "activity"
              ? filter.event_types
              : filter?.type === "object_type"
                ? filter.object_types
                : [];

          return (
            <Stack gap={4} flex={1} mih={0} className={PICKER_CLASS}>
              <FillHeightStyles />
              <Picker
                variant="list"
                multiple
                cutoff
                ocelId={ocelId}
                ocelVersion="original"
                value={selected}
                onChange={(next) =>
                  field.onChange(
                    isEvents
                      ? {
                          type: "activity",
                          event_types: next,
                          mode: "include",
                        }
                      : {
                          type: "object_type",
                          object_types: next,
                          mode: "include",
                        },
                  )
                }
              />
            </Stack>
          );
        }}
      />
    );
  };

export const ActivityFilter: FilterViewType<"activity"> = {
  title: "Activity",
  description:
    "Filters the event log by activity (the event type). Only events of the selected activities are kept. The list shows how many events exist per activity to help you decide what to keep.",
  ViewComponent: EntityFilter("events"),
  generateDefault: () => [
    { type: "activity", event_types: [], mode: "include" },
  ],
  cleanUpFilters: (filter) => {
    if (!filter[0] || filter[0].event_types.length === 0) {
      return [];
    }
    return [filter[0]];
  },
};

export const ObjectTypeFilter: FilterViewType<"object_type"> = {
  title: "Object Type",
  description:
    "Filters the log by object type. Only objects of the selected types are kept. The list shows how many objects exist per type to help you decide what to keep.",
  ViewComponent: EntityFilter("objects"),
  generateDefault: () => [
    { type: "object_type", object_types: [], mode: "include" },
  ],
  cleanUpFilters: (filter) => {
    if (!filter[0] || filter[0].object_types.length === 0) {
      return [];
    }
    return [filter[0]];
  },
};
