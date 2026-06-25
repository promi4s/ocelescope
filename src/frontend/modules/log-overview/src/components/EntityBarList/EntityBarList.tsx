import { BarList } from "@ocelescope/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";

const countHook = {
  events: useEventCounts,
  objects: useObjectCounts,
};

export const EntityBarList: React.FC<{
  ocelId: string;
  type: keyof typeof countHook;
  maxVisibleItems?: number;
}> = ({ ocelId, type, maxVisibleItems = 8 }) => {
  const { data: counts = {} } = countHook[type](ocelId);

  return (
    <BarList
      data={counts}
      labelHeader={type === "events" ? "Activity" : "Object type"}
      maxVisibleItems={maxVisibleItems}
    />
  );
};
