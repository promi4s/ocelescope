import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { type Control, Controller } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";
import { EntityTypeFilterInput } from "../inputs/EntityTypeFilter";
import type { FilterViewType } from ".";

const EntityFilter: (entityType: "events" | "objects") => React.FC<{
  ocelId: string;
  control: Control<GroupedOCELFilter>;
}> =
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
          name={isEvents ? "activity.event_types" : "object_type.object_types"}
          control={control}
          render={({ field }) => (
            <EntityTypeFilterInput
              entityTypes={Object.entries(entityCounts ?? {}).map(
                ([activity, count]) => ({ key: activity, value: count }),
              )}
              selectedEntityTypes={field.value ?? []}
              showGraph
              label={isEvents ? "Activities" : "Object Types"}
              onChange={field.onChange}
            />
          )}
        />
      </form>
    );
  };

export const ActivityFilter: FilterViewType<"activity"> = {
  title: "Activity",
  ViewComponent: EntityFilter("events"),
  generateDefault: () => ({ type: "activity", event_types: [] }),
};

export const ObjectTypeFilter: FilterViewType<"object_type"> = {
  title: "Object Type",
  ViewComponent: EntityFilter("objects"),
  generateDefault: () => ({ type: "object_type", object_types: [] }),
};
