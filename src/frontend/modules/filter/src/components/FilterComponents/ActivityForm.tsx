import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { Controller, useForm } from "react-hook-form";
import type {
  NativeActivityFilter,
  NativeObjectTypeFilter,
} from "../../api/base";
import { EntityTypeFilterInput } from "../Inputs/EntityTypeFilter";

export const EntityTypeFilter: (entityType: "objects" | "events") => React.FC<{
  ocelId: string;
}> =
  (entityType) =>
  ({ ocelId }) => {
    const isEvents = entityType === "events";

    const { data: entityCounts } = (
      isEvents ? useEventCounts : useObjectCounts
    )(ocelId, {
      ocel_version: "original",
    });

    const { control } = useForm<{
      entityNames:
        | NativeActivityFilter["event_types"]
        | NativeObjectTypeFilter["object_types"];
    }>({
      defaultValues: { entityNames: [] },
    });

    return (
      <form>
        <Controller
          name="entityNames"
          control={control}
          render={({ field }) => (
            <EntityTypeFilterInput
              entityTypes={Object.entries(entityCounts ?? {}).map(
                ([activity, count]) => ({ key: activity, value: count }),
              )}
              selectedEntityTypes={field.value}
              showGraph
              label={isEvents ? "Activities" : "Object Types"}
              onChange={field.onChange}
            />
          )}
        />
      </form>
    );
  };
