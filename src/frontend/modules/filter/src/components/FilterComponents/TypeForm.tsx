import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { type Control, Controller } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";
import { EntityTypeFilterInput } from "../inputs/EntityTypeFilter";

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

export const ActivityFilter = EntityFilter("events");
export const ObjectTypeFilter = EntityFilter("objects");
