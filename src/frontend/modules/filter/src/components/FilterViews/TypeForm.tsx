import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { Controller } from "react-hook-form";
import type { FilterView, FilterViewType } from "../../types/filter";
import { EntityTypeFilterInput } from "../inputs/EntityTypeFilter";

const EntityFilter: (
  entityType: "events" | "objects",
) => FilterView<"activity" | "object_type"> =
  (entityType) =>
  ({ ocelId, control }) => {
    const isEvents = entityType === "events";
    const { data: entityCounts } = (
      isEvents ? useEventCounts : useObjectCounts
    )(ocelId, {
      ocel_version: "original",
    });

    return (
      <form>
        <Controller
          name={isEvents ? `activity.${0}.mode` : `object_type.${0}.mode`}
          control={control}
          render={({ field: modeField }) => (
            <Controller
              name={
                isEvents
                  ? `activity.${0}.event_types`
                  : `object_type.${0}.object_types`
              }
              control={control}
              render={({ field }) => (
                <EntityTypeFilterInput
                  entityTypes={Object.entries(entityCounts ?? {}).map(
                    ([activity, count]) => ({ key: activity, value: count }),
                  )}
                  selectedEntityTypes={field.value ?? []}
                  mode={modeField.value ?? "exclude"}
                  onModeChange={modeField.onChange}
                  showGraph
                  label={isEvents ? "Activities" : "Object Types"}
                  onChange={field.onChange}
                />
              )}
            />
          )}
        />
      </form>
    );
  };

export const ActivityFilter: FilterViewType<"activity"> = {
  title: "Activity",
  description:
    "Filters the event log by activity (the event type). In include mode only events of the selected activities are kept; in exclude mode the selected activities are dropped and everything else is kept. The bar chart shows how many events exist per activity to help you decide what to keep.",
  ViewComponent: EntityFilter("events"),
  generateDefault: () => [
    { type: "activity", event_types: [], mode: "exclude" },
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
    "Filters the log by object type. In include mode only objects of the selected types are kept; in exclude mode the selected types are dropped and everything else is kept. The bar chart shows how many objects exist per type to help you decide what to keep.",
  ViewComponent: EntityFilter("objects"),
  generateDefault: () => [
    { type: "object_type", object_types: [], mode: "exclude" },
  ],
  cleanUpFilters: (filter) => {
    if (!filter[0] || filter[0].object_types.length === 0) {
      return [];
    }
    return [filter[0]];
  },
};
